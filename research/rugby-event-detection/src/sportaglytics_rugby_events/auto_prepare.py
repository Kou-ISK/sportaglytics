from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .manifest import (
    _event_annotations,
    _load_aliases,
    _load_json,
    _segments_for_angle,
    _select_angle,
    _timeline_instances,
)
from .package_compat import find_package_config_path, normalize_package_config
from .schema import DatasetManifest
from .sources import _auto_split_names, discover_sources, inspection_report


def _match_id(root: Path, package_root: Path, index: int) -> str:
    relative = package_root.relative_to(root)
    readable = "-".join(part for part in relative.parts if part and part != ".")
    if not readable:
        readable = package_root.name
    return f"{index:03d}-{readable}".replace(" ", "-")


def build_manifest_from_root(
    root: Path,
    aliases_path: Path,
    output_path: Path,
    dataset_id: str | None = None,
    seed: int = 42,
) -> tuple[DatasetManifest, dict[str, Any]]:
    root = root.expanduser().resolve()
    output_path = output_path.expanduser().resolve()
    aliases = _load_aliases(aliases_path.expanduser().resolve())
    report = inspection_report(root)

    prepared: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for source in discover_sources(root):
        if not source.usable:
            skipped.append(
                {
                    "packageRoot": str(source.package_root),
                    "reason": "; ".join(source.issues) or "unsupported source layout",
                }
            )
            continue
        try:
            config_path = find_package_config_path(source.package_root)
            if config_path is None:
                raise FileNotFoundError("config.json was not found")
            raw_config = _load_json(config_path)
            if not isinstance(raw_config, dict):
                raise ValueError("config root is not an object")
            config = normalize_package_config(raw_config)
            angle = _select_angle(config, None)
            timeline = _timeline_instances(_load_json(source.timeline_path))
            prepared.append(
                {
                    "packageRoot": source.package_root,
                    "angleId": angle.get("id"),
                    "segments": _segments_for_angle(source.package_root, angle),
                    "events": _event_annotations(timeline, aliases, {}),
                }
            )
        except (OSError, ValueError, TypeError) as error:
            skipped.append(
                {
                    "packageRoot": str(source.package_root),
                    "reason": str(error),
                }
            )

    if len(prepared) < 3:
        report["preparationFailures"] = skipped
        raise ValueError(
            "automatic preparation needs at least 3 usable matches after video/config validation; "
            "run the inspect command and review unresolved sources"
        )

    splits = _auto_split_names(len(prepared), seed)
    matches: list[dict[str, Any]] = []
    auto_packages: list[dict[str, Any]] = []
    for index, (item, split) in enumerate(zip(prepared, splits, strict=True), start=1):
        package_root = item["packageRoot"]
        match_id = _match_id(root, package_root, index)
        matches.append(
            {
                "matchId": match_id,
                "split": split,
                "angleId": item["angleId"],
                "segments": item["segments"],
                "events": item["events"],
            }
        )
        auto_packages.append(
            {
                "matchId": match_id,
                "split": split,
                "packagePath": str(package_root),
            }
        )

    manifest_json = {
        "version": 1,
        "datasetId": dataset_id or f"{root.name}-rugby-events",
        "matches": matches,
    }
    manifest = DatasetManifest.from_json(manifest_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest_json, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    auto_spec_path = output_path.with_name(f"{output_path.stem}.auto-spec.json")
    with auto_spec_path.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "version": 1,
                "datasetId": manifest.dataset_id,
                "packages": auto_packages,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")

    report["preparationFailures"] = skipped
    report["preparedSources"] = len(matches)
    report["automaticSplit"] = {
        "seed": seed,
        "train": sum(1 for match in matches if match["split"] == "train"),
        "validation": sum(1 for match in matches if match["split"] == "validation"),
        "test": sum(1 for match in matches if match["split"] == "test"),
    }
    report["manifestPath"] = str(output_path)
    report["generatedSpecPath"] = str(auto_spec_path)
    report_path = output_path.with_name(f"{output_path.stem}.sources.json")
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    report["reportPath"] = str(report_path)
    return manifest, report
