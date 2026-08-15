from __future__ import annotations

from dataclasses import asdict
import gc
import json
from pathlib import Path
from typing import Any

import torch

from .dataset import build_training_samples
from .metrics import Prediction, evaluate_all, select_thresholds
from .models import build_model
from .schema import DatasetManifest, EVENT_TYPES, ModelCandidate
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
) -> tuple:
    return tuple(match for match in manifest.matches if match.split == split)


def _prediction_json(
    matches: tuple,
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
    training_matches: tuple,
    test_matches: tuple,
) -> dict[str, object]:
    return {
        "datasetId": dataset_id,
        "trainingMatchIds": [match.match_id for match in training_matches],
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


def _metric_json(metrics: dict) -> dict[str, object]:
    return {
        event_type: value.to_json()
        for event_type, value in metrics.items()
    }


def _benchmark_one(
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
    model_dir = output_root / candidate.model_id
    model_dir.mkdir(parents=True, exist_ok=True)
    train_matches = _matches_for_split(manifest, "train")
    validation_matches = _matches_for_split(manifest, "validation")
    test_matches = _matches_for_split(manifest, "test")
    if not train_matches:
        raise ValueError("dataset manifest has no train split")

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
    training = train_model(
        bundle,
        train_samples,
        validation_samples,
        model_dir / "checkpoint.pt",
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
    test_scan = scan_matches(
        bundle,
        test_matches,
        stride_seconds,
        batch_size,
        nms_seconds,
    )
    test_metrics = evaluate_all(
        test_matches,
        test_scan.predictions,
        thresholds,
    )
    all_events_pass = all(
        test_metrics[event_type].passes_gate
        for event_type in EVENT_TYPES
    )
    product_gate_passed = candidate.production_eligible and all_events_pass

    _write_json(model_dir / "thresholds.json", thresholds)
    _write_json(
        model_dir / "validation-predictions.json",
        _prediction_json(validation_matches, validation_scan.predictions),
    )
    _write_json(
        model_dir / "test-predictions.json",
        _prediction_json(test_matches, test_scan.predictions),
    )
    _write_json(
        model_dir / "test-ground-truth.json",
        _ground_truth_json(manifest.dataset_id, train_matches, test_matches),
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
        "testScan": _scan_json(test_scan),
        "selectedThresholds": thresholds,
        "testMetrics": _metric_json(test_metrics),
        "allEventsPassQualityGate": all_events_pass,
        "productionGatePassed": product_gate_passed,
        "averageF1": sum(metric.f1 for metric in test_metrics.values())
        / len(test_metrics),
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
            result = _benchmark_one(
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
                "productionGatePassed": False,
            }
        results.append(result)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()

    successful = [
        result for result in results if result.get("status") != "failed"
    ]
    ranked = sorted(
        successful,
        key=lambda result: (
            bool(result.get("productionGatePassed")),
            bool(result.get("productionEligibleByLicense")),
            float(result.get("averageF1", 0.0)),
            -float(
                (result.get("testScan") or {}).get(
                    "wallSecondsPerVideoMinute",
                    float("inf"),
                )
            ),
        ),
        reverse=True,
    )
    production_winner = next(
        (
            result["modelId"]
            for result in ranked
            if result.get("productionGatePassed") is True
        ),
        None,
    )
    report = {
        "version": 1,
        "datasetId": manifest.dataset_id,
        "strategy": strategy,
        "learningRate": resolved_learning_rate,
        "qualityGate": {
            "precision": 0.95,
            "recall": 0.90,
            "evaluatedMatches": 5,
            "timestampWithinTwoSecondsRate": 0.90,
        },
        "selectionPolicy": (
            "Confidence thresholds are selected on validation matches only. "
            "The locked thresholds are then evaluated on unseen test matches. "
            "Non-commercial checkpoints cannot become production winners."
        ),
        "productionWinner": production_winner,
        "ranking": [result["modelId"] for result in ranked],
        "results": results,
    }
    _write_json(output_root / "benchmark-report.json", report)
    return report
