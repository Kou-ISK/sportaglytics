from __future__ import annotations

import json
from collections import Counter
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
from .schema import EVENT_TYPES, DatasetManifest
from .sources import _auto_split_names, discover_sources, inspection_report


def _match_id(root: Path, package_root: Path, index: int) -> str:
    relative = package_root.relative_to(root)
    readable = "-".join(part for part in relative.parts if part and part != ".")
    if not readable:
        readable = package_root.name
    return f"{index:03d}-{readable}".replace(" ", "-")


def _failure_category(reason: str) -> str:
    normalized = reason.casefold()
    if "not safe as complete supervision" in normalized:
        return "missing-required-event-labels"
    if "config" in normalized and ("not found" in normalized or "neither" in normalized):
        return "unsupported-or-missing-config"
    if "video" in normalized and (
        "not found" in normalized
        or "does not exist" in normalized
        or "unable to determine" in normalized
    ):
        return "unresolved-video"
    if "timeline" in normalized and ("neither" in normalized or "invalid" in normalized):
        return "unsupported-or-invalid-timeline"
    return "other"


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
    skipped: list[dict[str, Any]] = []
    for source in discover_sources(root):
        if not source.usable:
            reason = "; ".join(source.issues) or "unsupported source layout"
            skipped.append(
                {
                    "packageRoot": str(source.package_root),
                    "category": _failure_category(reason),
                    "reason": reason,
                    "actionNameCounts": source.action_name_counts,
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
            config = normalize_package_config(raw_config, source.package_root)
            angle = _select_angle(config, None)
            timeline = _timeline_instances(_load_json(source.timeline_path))
            events = _event_annotations(timeline, aliases, {})
            event_counts = Counter(event["eventType"] for event in events)
            missing_event_types = [
                event_type for event_type in EVENT_TYPES if event_counts[event_type] == 0
            ]
            if missing_event_types:
                reason = (
                    "source is not safe as complete supervision: no coded "
                    + ", ".join(missing_event_types)
                    + " events were found"
                )
                skipped.append(
                    {
                        "packageRoot": str(source.package_root),
                        "category": "missing-required-event-labels",
                        "reason": reason,
                        "missingEventTypes": missing_event_types,
                        "recognizedEventCounts": {
                            event_type: event_counts[event_type]
                            for event_type in EVENT_TYPES
                        },
                        "actionNameCounts": source.action_name_counts,
                    }
                )
                continue
            prepared.append(
                {
                    "packageRoot": source.package_root,
                    "angleId": angle.get("id"),
                    "segments": _segments_for_angle(source.package_root, angle),
                    "events": events,
                    "eventCounts": dict(event_counts),
                }
            )
        except Exception as error:
            # Dataset discovery is a per-source boundary. A malformed historical
            # package must be reported and skipped rather than blocking all other matches.
            reason = str(error)
            skipped.append(
                {
                    "packageRoot": str(source.package_root),
                    "category": _failure_category(reason),
                    "reason": reason,
                    "actionNameCounts": source.action_name_counts,
                }
            )

    if len(prepared) < 3:
        raise ValueError(
            "automatic preparation needs at least 3 safely coded matches after video/config "
            "and event-label validation; run the inspect command and review unresolved sources"
        )

    splits = _auto_split_names(len(prepared), seed)
    matches: list[dict[str, Any]] = []
    auto_packages: list[dict[str, Any]] = []
    split_event_counts = {
        "train": Counter(),
        "validation": Counter(),
        "test": Counter(),
    }
    all_event_counts = Counter()
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
                "eventCounts": item["eventCounts"],
            }
        )
        split_event_counts[split].update(item["eventCounts"])
        all_event_counts.update(item["eventCounts"])

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
                "eventTypes": list(EVENT_TYPES),
                "packages": auto_packages,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")

    failure_categories = Counter(
        str(item.get("category") or _failure_category(str(item.get("reason", ""))))
        for item in skipped
    )
    missing_type_counts = Counter()
    missing_combinations = Counter()
    for item in skipped:
        missing = item.get("missingEventTypes")
        if not isinstance(missing, list) or not missing:
            continue
        normalized_missing = tuple(str(value) for value in missing)
        missing_type_counts.update(normalized_missing)
        missing_combinations["+".join(normalized_missing)] += 1

    report_path = output_path.with_name(f"{output_path.stem}.sources.json")
    report["eventTypes"] = list(EVENT_TYPES)
    report["preparationFailures"] = skipped
    report["preparationFailureSummary"] = dict(sorted(failure_categories.items()))
    report["missingEventTypeSummary"] = {
        event_type: missing_type_counts[event_type]
        for event_type in EVENT_TYPES
    }
    report["missingEventCombinationSummary"] = dict(
        sorted(missing_combinations.items(), key=lambda item: (-item[1], item[0]))
    )
    report["preparedSources"] = len(matches)
    report["preparedEventCounts"] = {
        event_type: all_event_counts[event_type]
        for event_type in EVENT_TYPES
    }
    report["automaticSplit"] = {
        "seed": seed,
        "train": sum(1 for match in matches if match["split"] == "train"),
        "validation": sum(1 for match in matches if match["split"] == "validation"),
        "test": sum(1 for match in matches if match["split"] == "test"),
    }
    report["splitEventCounts"] = {
        split: {
            event_type: counts[event_type]
            for event_type in EVENT_TYPES
        }
        for split, counts in split_event_counts.items()
    }
    report["productionQualificationReadyByMatchCount"] = (
        report["automaticSplit"]["test"] >= 5
    )
    report["manifestPath"] = str(output_path)
    report["generatedSpecPath"] = str(auto_spec_path)
    report["reportPath"] = str(report_path)
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return manifest, report
