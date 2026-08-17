from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .arguments import normalize_forwarded_args
from .auto_prepare import build_manifest_from_root
from .benchmark import run_benchmark, run_qualification
from .manifest import build_manifest
from .privacy import root_fingerprint
from .sources import write_inspection_report
from .split_lock import default_split_lock_path
from .train_workflow import run_training_workflow

RESEARCH_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALIASES = RESEARCH_ROOT / "config" / "event-aliases.json"
DEFAULT_MODELS = RESEARCH_ROOT / "config" / "model-benchmarks.json"
DEFAULT_TRAIN_MODEL = "x3d-s-kinetics400"


def _selected_model_ids(value: str | None) -> set[str] | None:
    if value is None:
        return None
    selected = {item.strip() for item in value.split(",") if item.strip()}
    return selected or None


def _add_scan_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--device", default="auto")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--stride-seconds", type=float, default=0.5)
    parser.add_argument("--nms-seconds", type=float, default=4.0)


def _add_training_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--strategy",
        choices=("head", "full"),
        default="head",
        help="Train only the classifier head for screening, or fine-tune the full backbone.",
    )
    _add_scan_arguments(parser)
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--learning-rate", type=float, default=None)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--negative-ratio", type=float, default=2.0)
    parser.add_argument("--seed", type=int, default=42)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sportaglytics-rugby-events",
        description="Rugby event spotting research pipeline for SporTagLytics.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect = subparsers.add_parser(
        "inspect",
        help=(
            "Private local diagnostic: recursively inspect package layouts, raw action names "
            "and video candidates. Inspect output can contain source-identifying metadata."
        ),
    )
    inspect.add_argument("--root", type=Path, required=True)
    inspect.add_argument("--output", type=Path, default=None)

    prepare = subparsers.add_parser(
        "prepare",
        help=(
            "Create a match-level dataset manifest. Automatic --root mode anonymizes source "
            "identity in persisted research artifacts."
        ),
    )
    source_group = prepare.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--root",
        type=Path,
        help="Recursively discover every timeline.json below one source directory.",
    )
    source_group.add_argument("--spec", type=Path)
    prepare.add_argument("--aliases", type=Path, default=DEFAULT_ALIASES)
    prepare.add_argument("--output", type=Path, required=True)
    prepare.add_argument(
        "--dataset-id",
        type=str,
        default=None,
        help="Optional explicit dataset id for --root mode. The default is anonymous.",
    )
    prepare.add_argument(
        "--seed",
        type=int,
        default=42,
        help=(
            "Deterministic match-level split seed in --root mode. Once a split lock exists, "
            "changing this seed is rejected to preserve Test provenance."
        ),
    )

    train = subparsers.add_parser(
        "train",
        help=(
            "One-command workflow: discover coded matches, create an anonymized leakage-safe "
            "manifest and train one pretrained development candidate on train/validation only."
        ),
    )
    train.add_argument(
        "--root",
        type=Path,
        required=True,
        help="Parent directory containing coded current or supported legacy packages.",
    )
    train.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Run directory. Defaults to an anonymous dataset fingerprint plus model/strategy.",
    )
    train.add_argument("--aliases", type=Path, default=DEFAULT_ALIASES)
    train.add_argument("--models-config", type=Path, default=DEFAULT_MODELS)
    train.add_argument(
        "--model",
        default=DEFAULT_TRAIN_MODEL,
        help=f"Pretrained model id. Defaults to {DEFAULT_TRAIN_MODEL}.",
    )
    _add_training_arguments(train)

    benchmark = subparsers.add_parser(
        "benchmark",
        help=(
            "Fine-tune and compare pretrained video models using train/validation only. "
            "This command never scans the held-out test split."
        ),
    )
    benchmark.add_argument("--manifest", type=Path, required=True)
    benchmark.add_argument("--models-config", type=Path, default=DEFAULT_MODELS)
    benchmark.add_argument("--output-dir", type=Path, required=True)
    benchmark.add_argument(
        "--models",
        type=str,
        default=None,
        help="Comma-separated model ids. Defaults to all configured candidates.",
    )
    _add_training_arguments(benchmark)

    qualify = subparsers.add_parser(
        "qualify",
        help=(
            "Run one frozen production-eligible checkpoint and its validation-selected "
            "thresholds on the held-out test split."
        ),
    )
    qualify.add_argument("--manifest", type=Path, required=True)
    qualify.add_argument("--models-config", type=Path, default=DEFAULT_MODELS)
    qualify.add_argument("--model-id", required=True)
    qualify.add_argument("--checkpoint", type=Path, required=True)
    qualify.add_argument("--thresholds", type=Path, required=True)
    qualify.add_argument("--output-dir", type=Path, required=True)
    qualify.add_argument(
        "--strategy",
        choices=("head", "full"),
        default="head",
        help="Must match the strategy stored in the frozen checkpoint.",
    )
    _add_scan_arguments(qualify)
    return parser


def _default_train_output(root: Path, strategy: str) -> Path:
    dataset_name = f"dataset-{root_fingerprint(root)[:12]}"
    model_name = "x3d" if DEFAULT_TRAIN_MODEL.startswith("x3d") else "model"
    return RESEARCH_ROOT / "runs" / f"{dataset_name}-{model_name}-{strategy}"


def main(argv: list[str] | None = None) -> None:
    forwarded_args = list(sys.argv[1:] if argv is None else argv)
    args = _build_parser().parse_args(normalize_forwarded_args(forwarded_args))
    if args.command == "inspect":
        resolved_output = (
            args.output.expanduser().resolve() if args.output is not None else None
        )
        report = write_inspection_report(
            args.root.expanduser().resolve(),
            resolved_output,
        )
        if resolved_output is None:
            payload = report
        else:
            payload = {
                "privacyWarning": "inspect output contains private source metadata; do not publish it",
                "timelineFilesFound": report["timelineFilesFound"],
                "usableSources": report["usableSources"],
                "unresolvedSources": report["unresolvedSources"],
                "outputFile": resolved_output.name,
            }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if args.command == "prepare":
        output_path = args.output.expanduser().resolve()
        aliases_path = args.aliases.expanduser().resolve()
        if args.root is not None:
            root = args.root.expanduser().resolve()
            manifest, report = build_manifest_from_root(
                root=root,
                aliases_path=aliases_path,
                output_path=output_path,
                dataset_id=args.dataset_id,
                seed=args.seed,
                split_lock_path=default_split_lock_path(root),
            )
            print(
                json.dumps(
                    {
                        "datasetId": manifest.dataset_id,
                        "sourceIdentity": "anonymized",
                        "matches": len(manifest.matches),
                        "outputFile": output_path.name,
                        "sourceReportFile": report.get("reportFile"),
                        "generatedSpecFile": report.get("generatedSpecFile"),
                        "automaticSplit": report.get("automaticSplit"),
                        "splitLock": report.get("splitLock"),
                        "preparedEventCounts": report.get("preparedEventCounts"),
                        "splitEventCounts": report.get("splitEventCounts"),
                        "skippedSources": len(report.get("preparationFailures", [])),
                        "skippedSourceReasons": report.get("preparationFailureSummary"),
                        "productionQualificationReadyByMatchCount": report.get(
                            "productionQualificationReadyByMatchCount"
                        ),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return

        manifest = build_manifest(
            args.spec.expanduser().resolve(),
            aliases_path,
            output_path,
        )
        print(
            json.dumps(
                {
                    "datasetId": manifest.dataset_id,
                    "matches": len(manifest.matches),
                    "outputFile": output_path.name,
                    "privacyWarning": (
                        "explicit --spec mode preserves caller-provided identifiers and paths; "
                        "do not publish its manifest unless the spec is already anonymized"
                    ),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    if args.command == "train":
        root = args.root.expanduser().resolve()
        output_root = (
            args.output_dir.expanduser().resolve()
            if args.output_dir is not None
            else _default_train_output(root, args.strategy).resolve()
        )
        report = run_training_workflow(
            root=root,
            output_root=output_root,
            aliases_path=args.aliases,
            models_config_path=args.models_config,
            model_id=args.model,
            strategy=args.strategy,
            device_name=args.device,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.learning_rate,
            weight_decay=args.weight_decay,
            negative_ratio=args.negative_ratio,
            stride_seconds=args.stride_seconds,
            nms_seconds=args.nms_seconds,
            seed=args.seed,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    if args.command == "benchmark":
        report = run_benchmark(
            manifest_path=args.manifest.expanduser().resolve(),
            models_config_path=args.models_config.expanduser().resolve(),
            output_root=args.output_dir.expanduser().resolve(),
            selected_ids=_selected_model_ids(args.models),
            strategy=args.strategy,
            device_name=args.device,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.learning_rate,
            weight_decay=args.weight_decay,
            negative_ratio=args.negative_ratio,
            stride_seconds=args.stride_seconds,
            nms_seconds=args.nms_seconds,
            seed=args.seed,
        )
    else:
        report = run_qualification(
            manifest_path=args.manifest.expanduser().resolve(),
            models_config_path=args.models_config.expanduser().resolve(),
            model_id=args.model_id,
            checkpoint_path=args.checkpoint.expanduser().resolve(),
            thresholds_path=args.thresholds.expanduser().resolve(),
            output_root=args.output_dir.expanduser().resolve(),
            strategy=args.strategy,
            device_name=args.device,
            batch_size=args.batch_size,
            stride_seconds=args.stride_seconds,
            nms_seconds=args.nms_seconds,
        )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
