from __future__ import annotations

from collections import Counter
from dataclasses import asdict
import gc
import hashlib
import json
from pathlib import Path
from typing import Any

import torch

from .dataset import (
    DEFAULT_POSITIVE_SAMPLES_PER_EVENT,
    DEFAULT_POSITIVE_SPAN_SECONDS,
    build_negative_candidate_pool,
    build_training_samples,
    clip_sample_key,
)
from .metrics import (
    EventMetrics,
    Prediction,
    ResearchEventSummary,
    evaluate_all,
    select_research_thresholds,
    select_thresholds,
    summarize_research_all,
)
from .models import build_model
from .schema import DatasetManifest, EVENT_TYPES, MatchManifest, ModelCandidate
from .spotting import ScanSummary, scan_matches
from .training import mine_hard_negative_samples, train_model

HARD_NEGATIVE_RATIO_TO_POSITIVES = 0.5
HARD_NEGATIVE_MIN_EVENT_CONFIDENCE = 0.35
HARD_NEGATIVE_POOL_MULTIPLIER = 8
HARD_NEGATIVE_MIN_SCORING_POOL = 600
HARD_NEGATIVE_REFINEMENT_EPOCHS = 2


def _progress(message: str) -> None:
    print(f"[rugby-events] {message}", flush=True)


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
        # Include validation matches because they influenced model/threshold selection.
        # The independent evaluator uses this list to reject any held-out overlap.
        "trainingMatchIds": [match.match_id for match in development_matches],
        "matches": [
            {
                "matchId": match.match_id,
                "events": [
                    {
                        "eventType": event.event_type,
                        "anchorTime": event.anchor_time_seconds,
                        "endTime": event.interval_end_seconds,
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


def _metric_json(metrics: dict[str, EventMetrics]) -> dict[str, object]:
    return {
        event_type: value.to_json()
        for event_type, value in metrics.items()
    }


def _research_summary_json(
    metrics: dict[str, ResearchEventSummary],
) -> dict[str, object]:
    return {
        event_type: value.to_json()
        for event_type, value in metrics.items()
    }


def _sample_counts(samples: list[object]) -> dict[str, int]:
    counts = Counter(getattr(sample, "event_type", "unknown") for sample in samples)
    return dict(sorted(counts.items()))


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
    """Train and rank one candidate using Train/Validation only."""

    model_dir = output_root / candidate.model_id
    model_dir.mkdir(parents=True, exist_ok=True)
    validation_matches = _matches_for_split(manifest, "validation")

    _progress(f"building interval-supervised samples for {candidate.model_id}")
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
    initial_train_sample_counts = _sample_counts(train_samples)
    validation_sample_counts = _sample_counts(validation_samples)
    _progress(
        f"samples ready: train={len(train_samples)} {initial_train_sample_counts}, "
        f"validation={len(validation_samples)} {validation_sample_counts}, "
        f"validationMatches={len(validation_matches)}"
    )

    _progress(
        f"loading pretrained model {candidate.model_id}; first run may download its checkpoint"
    )
    bundle = build_model(candidate, strategy, device_name)
    _progress(f"model ready: {candidate.model_id} on {bundle.device}")

    initial_checkpoint_path = model_dir / "checkpoint-before-hard-negatives.pt"
    checkpoint_path = model_dir / "checkpoint.pt"
    initial_training = train_model(
        bundle,
        train_samples,
        validation_samples,
        initial_checkpoint_path,
        epochs,
        batch_size,
        learning_rate,
        weight_decay,
        seed,
    )

    # Mine confusing background only from Train. Validation remains untouched until
    # final threshold/model evaluation, and Test is never decoded by this command.
    background_pool = build_negative_candidate_pool(
        manifest,
        "train",
        candidate.clip_duration_seconds,
    )
    existing_background_keys = {
        clip_sample_key(sample)
        for sample in train_samples
        if sample.event_type == "other"
    }
    hard_negative_pool = [
        sample
        for sample in background_pool
        if clip_sample_key(sample) not in existing_background_keys
    ]
    positive_sample_count = sum(
        1 for sample in train_samples if sample.event_type != "other"
    )
    hard_negative_target = max(
        1,
        int(round(positive_sample_count * HARD_NEGATIVE_RATIO_TO_POSITIVES)),
    )
    hard_negative_scoring_limit = max(
        HARD_NEGATIVE_MIN_SCORING_POOL,
        hard_negative_target * HARD_NEGATIVE_POOL_MULTIPLIER,
    )
    hard_negatives, hard_negative_summary = mine_hard_negative_samples(
        bundle,
        hard_negative_pool,
        batch_size=batch_size,
        max_samples=hard_negative_target,
        max_scored_candidates=hard_negative_scoring_limit,
        min_event_confidence=HARD_NEGATIVE_MIN_EVENT_CONFIDENCE,
        seed=seed + 20_000,
    )

    hard_negative_training = None
    final_train_samples = list(train_samples)
    if hard_negatives:
        final_train_samples.extend(hard_negatives)
        refinement_epochs = min(
            HARD_NEGATIVE_REFINEMENT_EPOCHS,
            max(1, epochs),
        )
        refinement_learning_rate = learning_rate * 0.5
        _progress(
            f"hard-negative refinement: added={len(hard_negatives)}, "
            f"train={len(final_train_samples)}, epochs={refinement_epochs}, "
            f"learningRate={refinement_learning_rate:g}"
        )
        hard_negative_training = train_model(
            bundle,
            final_train_samples,
            validation_samples,
            checkpoint_path,
            refinement_epochs,
            batch_size,
            refinement_learning_rate,
            weight_decay,
            seed + 30_000,
        )
        final_training = hard_negative_training
    else:
        _progress("hard-negative refinement skipped: no sufficiently confusing background found")
        bundle.save(checkpoint_path)
        final_training = initial_training

    final_train_sample_counts = _sample_counts(final_train_samples)
    _progress(
        f"classifier training complete; scanning full validation matches at {stride_seconds:.2f}s stride"
    )
    validation_scan = scan_matches(
        bundle,
        validation_matches,
        stride_seconds,
        batch_size,
        nms_seconds,
    )
    _progress("computing research-optimal and product-conservative validation thresholds")
    product_thresholds = select_thresholds(
        validation_matches,
        validation_scan.predictions,
    )
    research_thresholds = select_research_thresholds(
        validation_matches,
        validation_scan.predictions,
    )
    product_validation_metrics = evaluate_all(
        validation_matches,
        validation_scan.predictions,
        product_thresholds,
    )
    research_validation_metrics = evaluate_all(
        validation_matches,
        validation_scan.predictions,
        research_thresholds,
    )
    research_summary = summarize_research_all(
        validation_matches,
        validation_scan.predictions,
    )

    thresholds_path = model_dir / "thresholds.json"
    research_thresholds_path = model_dir / "research-thresholds.json"
    _write_json(thresholds_path, product_thresholds)
    _write_json(research_thresholds_path, research_thresholds)
    _write_json(
        model_dir / "validation-predictions.json",
        _prediction_json(validation_matches, validation_scan.predictions),
    )

    minimum_precision = min(
        metric.precision for metric in product_validation_metrics.values()
    )
    average_recall = sum(
        metric.recall for metric in product_validation_metrics.values()
    ) / len(product_validation_metrics)
    average_precise_rate = sum(
        metric.timestamp_within_two_seconds_rate
        for metric in product_validation_metrics.values()
    ) / len(product_validation_metrics)
    average_f1 = sum(
        metric.f1 for metric in product_validation_metrics.values()
    ) / len(product_validation_metrics)
    average_research_best_f1 = sum(
        metric.best_f1 for metric in research_summary.values()
    ) / len(research_summary)
    average_research_recall = sum(
        metric.recall_at_best_f1 for metric in research_summary.values()
    ) / len(research_summary)
    average_research_precision = sum(
        metric.precision_at_best_f1 for metric in research_summary.values()
    ) / len(research_summary)
    _progress(
        f"validation ready: researchBestF1={average_research_best_f1:.3f}, "
        f"researchPrecision={average_research_precision:.3f}, "
        f"researchRecall={average_research_recall:.3f}, "
        f"productMinPrecision={minimum_precision:.3f}"
    )

    return {
        "modelId": candidate.model_id,
        "family": candidate.family,
        "checkpoint": candidate.checkpoint,
        "license": candidate.license_name,
        "productionEligibleByLicense": candidate.production_eligible,
        "strategy": strategy,
        "device": str(bundle.device),
        "weakSupervision": {
            "positiveSamplesPerEvent": DEFAULT_POSITIVE_SAMPLES_PER_EVENT,
            "maxPositiveSpanSeconds": DEFAULT_POSITIVE_SPAN_SECONDS,
            "negativeSamplingExcludesFullCodedIntervals": True,
        },
        "hardNegativeMining": {
            "trainOnly": True,
            "ratioToPositiveSamples": HARD_NEGATIVE_RATIO_TO_POSITIVES,
            "minEventConfidence": HARD_NEGATIVE_MIN_EVENT_CONFIDENCE,
            "poolMultiplier": HARD_NEGATIVE_POOL_MULTIPLIER,
            "refinementEpochs": (
                hard_negative_training.epochs
                if hard_negative_training is not None
                else 0
            ),
            "summary": asdict(hard_negative_summary),
        },
        "sampleCounts": {
            "trainInitial": initial_train_sample_counts,
            "train": final_train_sample_counts,
            "validation": validation_sample_counts,
        },
        "initialTraining": asdict(initial_training),
        "training": asdict(final_training),
        "validationScan": _scan_json(validation_scan),
        # thresholds.json remains the conservative product candidate for qualification.
        "selectedThresholds": product_thresholds,
        "productThresholds": product_thresholds,
        "researchThresholds": research_thresholds,
        "validationMetrics": _metric_json(product_validation_metrics),
        "researchValidationMetrics": _metric_json(research_validation_metrics),
        "researchSummary": _research_summary_json(research_summary),
        "minimumValidationPrecision": minimum_precision,
        "averageValidationRecall": average_recall,
        "averageValidationTimestampWithinTwoSecondsRate": average_precise_rate,
        "averageValidationF1": average_f1,
        "averageResearchBestF1": average_research_best_f1,
        "averageResearchPrecisionAtBestF1": average_research_precision,
        "averageResearchRecallAtBestF1": average_research_recall,
        "meetsValidationPrecisionTarget": minimum_precision >= 0.95,
        "checkpointSha256": _sha256(checkpoint_path),
        "initialCheckpointSha256": _sha256(initial_checkpoint_path),
        "thresholdsSha256": _sha256(thresholds_path),
        "researchThresholdsSha256": _sha256(research_thresholds_path),
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
            _progress(f"{candidate.model_id} failed: {error}")
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
            float(result.get("averageResearchBestF1", 0.0)),
            float(result.get("averageResearchRecallAtBestF1", 0.0)),
            float(result.get("averageResearchPrecisionAtBestF1", 0.0)),
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
    screening_winner = production_ranking[0].get("modelId") if production_ranking else None

    report = {
        "version": 4,
        "mode": "validation-screen",
        "datasetId": manifest.dataset_id,
        "strategy": strategy,
        "learningRate": resolved_learning_rate,
        "validationPrecisionTarget": 0.95,
        "selectionPolicy": (
            "Research ranking uses best-F1 validation operating points so model discrimination "
            "is separated from the conservative product precision gate. Hard-negative mining "
            "uses Train background only; Validation remains model/threshold selection data and "
            "the held-out Test split is never decoded by this command. Product thresholds are "
            "selected on Validation only and remain the only thresholds eligible for held-out "
            "qualification."
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
        raise FileNotFoundError(f"thresholds does not exist: {thresholds_path}")

    thresholds = _read_thresholds(thresholds_path)
    _progress(f"loading frozen qualification model {candidate.model_id}")
    bundle = build_model(
        candidate,
        strategy,
        device_name,
        pretrained_backbone=False,
    )
    bundle.load(checkpoint_path)
    test_matches = _matches_for_split(manifest, "test")
    _progress(
        f"starting held-out Test scan: matches={len(test_matches)}, stride={stride_seconds:.2f}s"
    )
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
    _write_json(
        output_root / "test-predictions.json",
        _prediction_json(test_matches, test_scan.predictions),
    )
    development_matches = tuple(
        match for match in manifest.matches if match.split != "test"
    )
    _write_json(
        output_root / "test-ground-truth.json",
        _ground_truth_json(
            manifest.dataset_id,
            development_matches,
            test_matches,
        ),
    )
    _write_json(output_root / "thresholds.json", thresholds)

    report = {
        "version": 2,
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
            "predictionDistanceFromCodedIntervalWithinTwoSecondsRate": 0.90,
        },
        "policy": (
            "This command evaluates exactly one frozen production-eligible checkpoint and "
            "its preselected validation thresholds. Timing error is measured to the nearest "
            "coded interval boundary, so a prediction anywhere inside the human-coded action "
            "range has zero timing error. If this test result informs further model changes, "
            "use a new held-out test set for the next production claim."
        ),
    }
    _write_json(output_root / "qualification-report.json", report)
    return report
