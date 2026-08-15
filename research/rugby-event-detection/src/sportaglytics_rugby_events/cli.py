from __future__ import annotations

import argparse
import json
from pathlib import Path

from .benchmark import run_benchmark, run_qualification
from .manifest import build_manifest

RESEARCH_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALIASES = RESEARCH_ROOT / "config" / "event-aliases.json"
DEFAULT_MODELS = RESEARCH_ROOT / "config" / "model-benchmarks.json"


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


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sportaglytics-rugby-events",
        description="Rugby event spotting research pipeline for SporTagLytics.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser(
        "prepare",
        help="Convert human-coded SporTagLytics packages into a match-level dataset manifest.",
    )
    prepare.add_argument("--spec", type=Path, required=True)
    prepare.add_argument("--aliases", type=Path, default=DEFAULT_ALIASES)
    prepare.add_argument("--output", type=Path, required=True)

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
    benchmark.add_argument(
        "--strategy",
        choices=("head", "full"),
        default="head",
        help="Train only the classifier head for screening, or fine-tune the full backbone.",
    )
    _add_scan_arguments(benchmark)
    benchmark.add_argument("--epochs", type=int, default=5)
    benchmark.add_argument("--learning-rate", type=float, default=None)
    benchmark.add_argument("--weight-decay", type=float, default=0.01)
    benchmark.add_argument("--negative-ratio", type=float, default=2.0)
    benchmark.add_argument("--seed", type=int, default=42)

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


def main() -> None:
    args = _build_parser().parse_args()
    if args.command == "prepare":
        manifest = build_manifest(
            args.spec.expanduser().resolve(),
            args.aliases.expanduser().resolve(),
            args.output.expanduser().resolve(),
        )
        print(
            json.dumps(
                {
                    "datasetId": manifest.dataset_id,
                    "matches": len(manifest.matches),
                    "output": str(args.output),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
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
