from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .auto_prepare import build_manifest_from_root
from .benchmark import run_benchmark, run_qualification
from .manifest import build_manifest
from .sources import write_inspection_report

RESEARCH_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALIASES = RESEARCH_ROOT / "config" / "event-aliases.json"
DEFAULT_MODELS = RESEARCH_ROOT / "config" / "model-benchmarks.json"


def _selected_model_ids(value: str | None) -> set[str] | None:
    if value is None:
        return None
    selected = {item.strip() for item in value.split(",") if item.strip()}
    return selected or None


def _normalize_forwarded_args(argv: list[str]) -> list[str]:
    """Remove pnpm's literal separator when it is forwarded after the subcommand.

    Some pnpm versions forward ``pnpm run <script> -- --flag`` as
    ``<python> <subcommand> -- --flag``. argparse treats that standalone ``--``
    as end-of-options, so the following required flags become positional values.
    Accept both forms without changing the documented pnpm commands.
    """

    if len(argv) >= 2 and argv[1] == "--":
        return [argv[0], *argv[2:]]
    return argv


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

    inspect = subparsers.add_parser(
        "inspect",
        help=(
            "Recursively find timeline.json files and report current/legacy package layouts, "
            "action names and nearby video candidates without changing source data."
        ),
    )
    inspect.add_argument("--root", type=Path, required=True)
    inspect.add_argument("--output", type=Path, default=None)

    prepare = subparsers.add_parser(
        "prepare",
        help=(
            "Create a match-level dataset manifest. Use --root for automatic recursive "
            "discovery or --spec for an explicitly curated dataset."
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
        help="Optional dataset id for --root mode. Defaults to <root-name>-rugby-events.",
    )
    prepare.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Deterministic match-level train/validation/test split seed in --root mode.",
    )

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


def main(argv: list[str] | None = None) -> None:
    forwarded_args = list(sys.argv[1:] if argv is None else argv)
    args = _build_parser().parse_args(_normalize_forwarded_args(forwarded_args))
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
                "root": report["root"],
                "timelineFilesFound": report["timelineFilesFound"],
                "usableSources": report["usableSources"],
                "unresolvedSources": report["unresolvedSources"],
                "output": str(resolved_output),
            }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if args.command == "prepare":
        output_path = args.output.expanduser().resolve()
        aliases_path = args.aliases.expanduser().resolve()
        if args.root is not None:
            manifest, report = build_manifest_from_root(
                root=args.root.expanduser().resolve(),
                aliases_path=aliases_path,
                output_path=output_path,
                dataset_id=args.dataset_id,
                seed=args.seed,
            )
            print(
                json.dumps(
                    {
                        "datasetId": manifest.dataset_id,
                        "matches": len(manifest.matches),
                        "output": str(output_path),
                        "sourceReport": report.get("reportPath"),
                        "generatedSpec": report.get("generatedSpecPath"),
                        "automaticSplit": report.get("automaticSplit"),
                        "skippedSources": len(report.get("preparationFailures", [])),
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
                    "output": str(output_path),
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
