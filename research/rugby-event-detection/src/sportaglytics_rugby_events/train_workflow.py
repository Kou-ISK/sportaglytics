from __future__ import annotations

from pathlib import Path
from typing import Any

from .auto_prepare import build_manifest_from_root
from .benchmark import run_benchmark


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

    _progress(f"source discovery start: {root}")
    manifest_path = output_root / "manifest.json"
    manifest, source_report = build_manifest_from_root(
        root=root,
        aliases_path=aliases_path.expanduser().resolve(),
        output_path=manifest_path,
        dataset_id=f"{root.name}-rugby-events",
        seed=seed,
    )
    split = source_report.get("automaticSplit")
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
    _progress(f"prepared event counts: {prepared_event_counts}")
    _progress(f"split event counts: {split_event_counts}")
    if failure_summary:
        _progress(f"skipped source reasons: {failure_summary}")
    if not qualification_ready:
        _progress(
            "development-only dataset: fewer than 5 held-out Test matches; "
            "do not use this run for production qualification"
        )
    _progress(f"manifest saved: {manifest_path}")
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
    _progress(f"development run complete: output={benchmark_root}")

    return {
        "mode": "prepare-and-train",
        "datasetId": manifest.dataset_id,
        "sourceRoot": str(root),
        "usableMatches": len(manifest.matches),
        "split": split,
        "preparedEventCounts": prepared_event_counts,
        "splitEventCounts": split_event_counts,
        "skippedSources": len(source_report.get("preparationFailures", [])),
        "skippedSourceReasons": failure_summary,
        "productionQualificationReadyByMatchCount": qualification_ready,
        "manifest": str(manifest_path),
        "sourceReport": source_report.get("reportPath"),
        "modelId": model_id,
        "strategy": strategy,
        "benchmarkOutput": str(benchmark_root),
        "screeningWinner": benchmark_report.get("screeningWinner"),
        "results": benchmark_report.get("results", []),
        "testPolicy": (
            "The held-out test split was not decoded or evaluated. Use qualify only after "
            "the model, strategy, stride, NMS and validation thresholds are frozen, and only "
            "when at least five held-out Test matches are available."
        ),
    }
