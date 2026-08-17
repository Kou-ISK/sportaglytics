from __future__ import annotations

from pathlib import Path
from typing import Any

from .auto_prepare import build_manifest_from_root
from .benchmark import run_benchmark
from .split_lock import default_split_lock_path


def _progress(message: str) -> None:
    print(f"[rugby-events] {message}", flush=True)


def run_training_workflow(
    *,
    root: Path,
    output_root: Path,
    aliases_path: Path,
    models_config_path: Path,
    model_id: str,
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
) -> dict[str, Any]:
    """Prepare coded matches and train one development candidate without scanning Test."""

    root = root.expanduser().resolve()
    output_root = output_root.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    _progress("source discovery start (source identity redacted)")
    manifest_path = output_root / "manifest.json"
    split_lock_path = default_split_lock_path(root)
    manifest, source_report = build_manifest_from_root(
        root=root,
        aliases_path=aliases_path.expanduser().resolve(),
        output_path=manifest_path,
        dataset_id=None,
        seed=seed,
        split_lock_path=split_lock_path,
    )
    split = source_report.get("automaticSplit")
    split_lock = source_report.get("splitLock", {})
    failure_summary = source_report.get("preparationFailureSummary", {})
    split_event_counts = source_report.get("splitEventCounts", {})
    prepared_event_counts = source_report.get("preparedEventCounts", {})
    qualification_ready = bool(
        source_report.get("productionQualificationReadyByMatchCount", False)
    )
    _progress(
        f"dataset ready: usableMatches={len(manifest.matches)}, split={split}, "
        f"skippedSources={len(source_report.get('preparationFailures', []))}"
    )
    if split_lock:
        _progress(
            f"split lock: status={split_lock.get('status')}, "
            f"file={split_lock.get('file')}, "
            f"preserved={split_lock.get('preservedCurrentMatches')}"
        )
    _progress(f"prepared event counts: {prepared_event_counts}")
    _progress(f"split event counts: {split_event_counts}")
    if failure_summary:
        _progress(f"skipped source reasons: {failure_summary}")
    if not qualification_ready:
        _progress(
            "development-only dataset: fewer than 5 held-out Test matches; "
            "do not use this run for production qualification"
        )
    _progress("manifest saved with anonymous source metadata")
    _progress(
        f"development training start: model={model_id}, strategy={strategy}, "
        f"epochs={epochs}, validationStride={stride_seconds:.2f}s"
    )

    benchmark_root = output_root / "benchmark"
    benchmark_report = run_benchmark(
        manifest_path=manifest_path,
        models_config_path=models_config_path.expanduser().resolve(),
        output_root=benchmark_root,
        selected_ids={model_id},
        strategy=strategy,
        device_name=device_name,
        epochs=epochs,
        batch_size=batch_size,
        learning_rate=learning_rate,
        weight_decay=weight_decay,
        negative_ratio=negative_ratio,
        stride_seconds=stride_seconds,
        nms_seconds=nms_seconds,
        seed=seed,
    )
    _progress("development run complete")

    return {
        "mode": "prepare-and-train",
        "datasetId": manifest.dataset_id,
        "sourceIdentity": "anonymized",
        "usableMatches": len(manifest.matches),
        "split": split,
        "splitLock": split_lock,
        "preparedEventCounts": prepared_event_counts,
        "splitEventCounts": split_event_counts,
        "skippedSources": len(source_report.get("preparationFailures", [])),
        "skippedSourceReasons": failure_summary,
        "productionQualificationReadyByMatchCount": qualification_ready,
        "manifestFile": manifest_path.name,
        "sourceReportFile": source_report.get("reportFile"),
        "modelId": model_id,
        "strategy": strategy,
        "benchmarkDirectory": benchmark_root.name,
        "screeningWinner": benchmark_report.get("screeningWinner"),
        "results": benchmark_report.get("results", []),
        "testPolicy": (
            "The held-out test split was not decoded or evaluated. Existing split assignments "
            "are locked across dataset growth so a previously used development match cannot "
            "silently become Test. Source identities are excluded from persisted training "
            "metadata. Use qualify only after the model, strategy, stride, NMS and validation "
            "thresholds are frozen, and only when at least five held-out Test matches are available."
        ),
    }
