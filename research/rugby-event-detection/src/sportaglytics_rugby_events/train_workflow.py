from __future__ import annotations

from pathlib import Path
from typing import Any

from .auto_prepare import build_manifest_from_root
from .benchmark import run_benchmark


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

    manifest_path = output_root / "manifest.json"
    manifest, source_report = build_manifest_from_root(
        root=root,
        aliases_path=aliases_path.expanduser().resolve(),
        output_path=manifest_path,
        dataset_id=f"{root.name}-rugby-events",
        seed=seed,
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

    return {
        "mode": "prepare-and-train",
        "datasetId": manifest.dataset_id,
        "sourceRoot": str(root),
        "usableMatches": len(manifest.matches),
        "split": source_report.get("automaticSplit"),
        "skippedSources": len(source_report.get("preparationFailures", [])),
        "manifest": str(manifest_path),
        "sourceReport": source_report.get("reportPath"),
        "modelId": model_id,
        "strategy": strategy,
        "benchmarkOutput": str(benchmark_root),
        "screeningWinner": benchmark_report.get("screeningWinner"),
        "results": benchmark_report.get("results", []),
        "testPolicy": (
            "The held-out test split was not decoded or evaluated. Use qualify only after "
            "the model, strategy, stride, NMS and validation thresholds are frozen."
        ),
    }
