from __future__ import annotations

from dataclasses import asdict
import gc
import hashlib
import json
from pathlib import Path
from typing import Any

import torch

from .dataset import build_training_samples
from .metrics import Prediction, evaluate_all, select_thresholds
from .models import build_model
from .schema import DatasetManifest, EVENT_TYPES, MatchManifest, ModelCandidate
from .spotting import ScanSummary, scan_matches
from .training import train_model


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_manifest(path: Path) -> DatasetManifest:
    return DatasetManifest.from_json(_read_json(path))


def load_model_candidates(
    path: Path,
    selected_ids: set[str] | None = None,
) -> list[ModelCandidate]:
    raw = _read_json(path)
    if not isinstance(raw, dict) or raw.get("version") != 1:
        raise ValueError("model benchmark config version must be 1")
    raw_models = raw.get("models")
    if not isinstance(raw_models, list) or not raw_models:
        raise ValueError("model benchmark config must contain models[]")
    models = [ModelCandidate.from_json(item) for item in raw_models]
    if selected_ids:
        models = [model for model in models if model.model_id in selected_ids]
        missing = selected_ids - {model.model_id for model in models}
        if missing:
            raise ValueError("unknown model ids: " + ", ".join(sorted(missing)))
    return models


def _matches_for_split(
    manifest: DatasetManifest,
    split: str,
) -> tuple[MatchManifest, ...]:
    return tuple(match for match in manifest.matches if match.split == split)


def _prediction_json(
    matches: tuple[MatchManifest, ...],
    predictions: list[Prediction],
) -> dict[str, object]:
    return {
        "matches": [
            {
                "matchId": match.match_id,
                "events": [
                    {
                        "eventType": prediction.event_type,
                        "anchorTime": prediction.anchor_time_seconds,
                        "confidence": prediction.confidence,
                    }
                    for prediction in predictions
                    if prediction.match_id == match.match_id
                ],
            }
            for match in matches
        ]
    }


def _ground_truth_json(
    dataset_id: str,
    development_matches: tuple[MatchManifest, ...],
    test_matches: tuple[MatchManifest, ...],
) -> dict[str, object]:
    return {
        "datasetId": dataset_id,
        # The independent Node evaluator only needs a list that must not overlap
        # the held-out test set. Include validation matches because they influenced
        # model/threshold selection even though no gradient update used them.
        "trainingMatchIds": [match.match_id for match in development_matches],
        "matches": [
            {
                "matchId": match.match_id,
                "events": [
                    {
                        "eventType": event.event_type,
                        "anchorTime": event.anchor_time_seconds,
                    }
                    for event in match.events
                ],
            }
            for match in test_matches
        ],
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def _scan_json(summary: ScanSummary) -> dict[str, object]:
    return {
        "windowCount": summary.window_count,
        "videoSeconds": summary.video_seconds,
        "wallSeconds": summary.wall_seconds,
        "wallSecondsPerVideoMinute": summary.wall_seconds_per_video_minute,
    }


def _metric_json(metrics: dict[str, object]) -> dict[str, object]:
    return {
        event_type: value.to_json()
        for event_type, value in metrics.items()
    }


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _screen_one(
    candidate: ModelCandidate,
    manifest: DatasetManifest,
    output_root: Path,
    strategy: str,
    device_name: str,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    weight_decay: float,
    negative_ratio: float,
    stride_seconds: float,
    nms_seconds: float,
    seed: int,
) -> dict[str, object]:
    """Train and rank one candidate using train/validation only.

    The held-out test split is intentionally never decoded here. This keeps model
    family selection, fine-tuning strategy selection and confidence-threshold
    selection out of the final qualification set.
    """

    model_dir = output_root / candidate.model_id
    model_dir.mkdir(parents=True, exist_ok=True)
    validation_matches = _matches_for_split(manifest, "validation")

    train_samples = build_training_samples(
        manifest,
        "train",
        candidate.clip_duration_seconds,
        negative_ratio,
        seed,
    )
    validation_samples = build_training_samples(
        manifest,
        "validation",
        candidate.clip_duration_seconds,
        negative_ratio,
        seed + 10_000,
    )

    bundle = build_model(candidate, strategy, device_name)
    checkpoint_path = model_dir / "checkpoint.pt"
    training = train_model(
        bundle,
        train_samples,
        validation_samples,
        checkpoint_path,
        epochs,
        batch_size,
        learning_rate,
        weight_decay,
        seed,
    )

    validation_scan = scan_matches(
        bundle,
        validation_matches,
        stride_seconds,
        batch_size,
        nms_seconds,
    )
    thresholds = select_thresholds(
        validation_matches,
        validation_scan.predictions,
    )
    validation_metrics = evaluate_all(
        validation_matches,
        validation_scan.predictions,
        thresholds,
    )

    thresholds_path = model_dir / "thresholds.json"
    _write_json(thresholds_path, thresholds)
    _write_json(
        model_dir / "validation-predictions.json",
        _prediction_json(validation_matches, validation_scan.predictions),
    )

    minimum_precision = min(
        metric.precision for metric in validation_metrics.values()
    )
    average_recall = sum(
        metric.recall for metric in validation_metrics.values()
    ) / len(validation_metrics)
    average_precise_rate = sum(
        metric.timestamp_within_two_seconds_rate
        for metric in validation_metrics.values()
    ) / len(validation_metrics)
    average_f1 = sum(metric.f1 for metric in validation_metrics.values()) / len(
        validation_metrics
    )

    return {
        "modelId": candidate.model_id,
        "family": candidate.family,
        "checkpoint": candidate.checkpoint,
        "license": candidate.license_name,
        "productionEligibleByLicense": candidate.production_eligible,
        "strategy": strategy,
        "device": str(bundle.device),
        "training": asdict(training),
        "validationScan": _scan_json(validation_scan),
        "selectedThresholds": thresholds,
        "validationMetrics": _metric_json(validation_metrics),
        "minimumValidationPrecision": minimum_precision,
        "averageValidationRecall": average_recall,
        "averageValidationTimestampWithinTwoSecondsRate": average_precise_rate,
        "averageValidationF1": average_f1,
        "meetsValidationPrecisionTarget": minimum_precision >= 0.95,
        "checkpointSha256": _sha256(checkpoint_path),
        "thresholdsSha256": _sha256(thresholds_path),
    }


def run_benchmark(
    manifest_path: Path,
    models_config_path: Path,
    output_root: Path,
    selected_ids: set[str] | None,
    strategy: str,
    device_name: str,
    epochs: int,
    batch_size: int,
    learning_rate: float | None,
    weight_decay: float,
    negative_ratio: float,
    stride_seconds: float,
    nms_seconds: float,
    seed: int,
) -> dict[str, object]:
    """Screen model candidates without touching the held-out test split."""

    manifest = load_manifest(manifest_path)
    candidates = load_model_candidates(models_config_path, selected_ids)
    if not candidates:
        raise ValueError("no model candidates selected")

    resolved_learning_rate = (
        learning_rate
        if learning_rate is not None
        else (1e-3 if strategy == "head" else 1e-5)
    )
    output_root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []

    for candidate in candidates:
        try:
            result = _screen_one(
                candidate,
                manifest,
                output_root,
                strategy,
                device_name,
                epochs,
                batch_size,
                resolved_learning_rate,
                weight_decay,
                negative_ratio,
                stride_seconds,
                nms_seconds,
                seed,
            )
        except Exception as error:
            result = {
                "modelId": candidate.model_id,
                "family": candidate.family,
                "checkpoint": candidate.checkpoint,
                "license": candidate.license_name,
                "productionEligibleByLicense": candidate.production_eligible,
                "strategy": strategy,
                "status": "failed",
                "error": str(error),
            }
        results.append(result)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()

    successful = [result for result in results if result.get("status") != "failed"]
    research_ranking = sorted(
        successful,
        key=lambda result: (
            float(result.get("minimumValidationPrecision", 0.0)),
            float(result.get("averageValidationRecall", 0.0)),
            float(result.get("averageValidationTimestampWithinTwoSecondsRate", 0.0)),
            float(result.get("averageValidationF1", 0.0)),
            -float(
                (result.get("validationScan") or {}).get(
                    "wallSecondsPerVideoMinute",
                    float("inf"),
                )
            ),
        ),
        reverse=True,
    )
    production_ranking = [
        result
        for result in research_ranking
        if result.get("productionEligibleByLicense") is True
    ]
    screening_winner = (
        production_ranking[0].get("modelId") if production_ranking else None
    )

    report = {
        "version": 2,
        "mode": "validation-screen",
        "datasetId": manifest.dataset_id,
        "strategy": strategy,
        "learningRate": resolved_learning_rate,
        "validationPrecisionTarget": 0.95,
        "selectionPolicy": (
            "All candidate comparison and confidence-threshold selection use train/validation "
            "matches only. The held-out test split is not scanned by this command. "
            "Non-commercial checkpoints remain research-only regardless of validation accuracy."
        ),
        "screeningWinner": screening_winner,
        "researchRanking": [result.get("modelId") for result in research_ranking],
        "productionRanking": [result.get("modelId") for result in production_ranking],
        "results": results,
    }
    _write_json(output_root / "benchmark-report.json", report)
    return report


def _read_thresholds(path: Path) -> dict[str, float]:
    raw = _read_json(path)
    if not isinstance(raw, dict):
        raise ValueError("thresholds must be an object")
    thresholds: dict[str, float] = {}
    for event_type in EVENT_TYPES:
        value = raw.get(event_type)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"missing numeric threshold for {event_type}")
        threshold = float(value)
        if threshold < 0 or threshold > 1:
            raise ValueError(f"threshold for {event_type} must be between 0 and 1")
        thresholds[event_type] = threshold
    return thresholds


def run_qualification(
    manifest_path: Path,
    models_config_path: Path,
    model_id: str,
    checkpoint_path: Path,
    thresholds_path: Path,
    output_root: Path,
    strategy: str,
    device_name: str,
    batch_size: int,
    stride_seconds: float,
    nms_seconds: float,
) -> dict[str, object]:
    """Evaluate one frozen production-eligible model on the held-out test split."""

    manifest = load_manifest(manifest_path)
    candidates = load_model_candidates(models_config_path, {model_id})
    candidate = candidates[0]
    if not candidate.production_eligible:
        raise ValueError(
            f"{candidate.model_id} is research-only and cannot be production-qualified"
        )
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"checkpoint does not exist: {checkpoint_path}")
    if not thresholds_path.is_file():
        raise FileNotFoundError(f"thresholds do not exist: {thresholds_path}")

    thresholds = _read_thresholds(thresholds_path)
    bundle = build_model(candidate, strategy, device_name)
    bundle.load(checkpoint_path)
    test_matches = _matches_for_split(manifest, "test")
    test_scan = scan_matches(
        bundle,
        test_matches,
        stride_seconds,
        batch_size,
        nms_seconds,
    )
    test_metrics = evaluate_all(test_matches, test_scan.predictions, thresholds)
    product_gate_passed = all(
        test_metrics[event_type].passes_gate for event_type in EVENT_TYPES
    )

    output_root.mkdir(parents=True, exist_ok=True)
    test_predictions_path = output_root / "test-predictions.json"
    test_ground_truth_path = output_root / "test-ground-truth.json"
    locked_thresholds_path = output_root / "thresholds.json"
    _write_json(
        test_predictions_path,
        _prediction_json(test_matches, test_scan.predictions),
    )
    development_matches = tuple(
        match for match in manifest.matches if match.split != "test"
    )
    _write_json(
        test_ground_truth_path,
        _ground_truth_json(
            manifest.dataset_id,
            development_matches,
            test_matches,
        ),
    )
    _write_json(locked_thresholds_path, thresholds)

    report = {
        "version": 1,
        "mode": "held-out-qualification",
        "datasetId": manifest.dataset_id,
        "modelId": candidate.model_id,
        "family": candidate.family,
        "license": candidate.license_name,
        "productionEligibleByLicense": True,
        "strategy": strategy,
        "device": str(bundle.device),
        "checkpointSha256": _sha256(checkpoint_path),
        "sourceThresholdsSha256": _sha256(thresholds_path),
        "lockedThresholds": thresholds,
        "testScan": _scan_json(test_scan),
        "testMetrics": _metric_json(test_metrics),
        "productGatePassed": product_gate_passed,
        "qualityGate": {
            "precision": 0.95,
            "recall": 0.90,
            "evaluatedMatches": 5,
            "timestampWithinTwoSecondsRate": 0.90,
        },
        "policy": (
            "This command evaluates exactly one frozen production-eligible checkpoint and "
            "its preselected validation thresholds. If this test result informs further "
            "model changes, use a new held-out test set for the next production claim."
        ),
    }
    _write_json(output_root / "qualification-report.json", report)
    return report
