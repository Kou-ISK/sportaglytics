from __future__ import annotations

import argparse
import json
from pathlib import Path

from .benchmark import run_benchmark
from .manifest import build_manifest

RESEARCH_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALIASES = RESEARCH_ROOT / "config" / "event-aliases.json"
DEFAULT_MODELS = RESEARCH_ROOT / "config" / "model-benchmarks.json"


def _selected_model_ids(value: str | None) -> set[str] | None:
    if value is None:
        return None
    selected = {item.strip() for item in value.split(",") if item.strip()}
    return selected or None


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
        help="Fine-tune and compare pretrained video models on validation/test spotting.",
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
    benchmark.add_argument("--device", default="auto")
    benchmark.add_argument("--epochs", type=int, default=5)
    benchmark.add_argument("--batch-size", type=int, default=4)
    benchmark.add_argument("--learning-rate", type=float, default=None)
    benchmark.add_argument("--weight-decay", type=float, default=0.01)
    benchmark.add_argument("--negative-ratio", type=float, default=2.0)
    benchmark.add_argument("--stride-seconds", type=float, default=0.5)
    benchmark.add_argument("--nms-seconds", type=float, default=4.0)
    benchmark.add_argument("--seed", type=int, default=42)
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
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
