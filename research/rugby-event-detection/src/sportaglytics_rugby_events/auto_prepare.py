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
from .privacy import (
    anonymize_segments,
    default_dataset_id,
    match_id_for_source,
    root_fingerprint,
    safe_failure_reason,
    sanitize_event,
)
from .schema import EVENT_TYPES, DatasetManifest
from .sources import _auto_split_names, discover_sources, inspection_report
from .split_lock import assign_locked_splits, source_key


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


def _safe_failure(
    *,
    source_id: str,
    category: str,
    missing_event_types: list[str] | None = None,
    recognized_event_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "sourceId": source_id,
        "category": category,
        "reason": safe_failure_reason(category),
    }
    if missing_event_types:
        result["missingEventTypes"] = missing_event_types
    if recognized_event_counts is not None:
        result["recognizedEventCounts"] = recognized_event_counts
    return result


def build_manifest_from_root(
    root: Path,
    aliases_path: Path,
    output_path: Path,
    dataset_id: str | None = None,
    seed: int = 42,
    split_lock_path: Path | None = None,
) -> tuple[DatasetManifest, dict[str, Any]]:
    root = root.expanduser().resolve()
    output_path = output_path.expanduser().resolve()
    aliases = _load_aliases(aliases_path.expanduser().resolve())
    private_inspection = inspection_report(root)
    resolved_dataset_id = dataset_id or default_dataset_id(root)

    prepared: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for source in discover_sources(root):
        anonymous_source_id = source_key(root, source.package_root)
        if not source.usable:
            private_reason = "; ".join(source.issues) or "unsupported source layout"
            category = _failure_category(private_reason)
            skipped.append(
                _safe_failure(
                    source_id=anonymous_source_id,
                    category=category,
                )
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
                skipped.append(
                    _safe_failure(
                        source_id=anonymous_source_id,
                        category="missing-required-event-labels",
                        missing_event_types=missing_event_types,
                        recognized_event_counts={
                            event_type: event_counts[event_type]
                            for event_type in EVENT_TYPES
                        },
                    )
                )
                continue
            prepared.append(
                {
                    "sourceKey": anonymous_source_id,
                    "segments": _segments_for_angle(source.package_root, angle),
                    "events": events,
                    "eventCounts": dict(event_counts),
                }
            )
        except Exception as error:
            category = _failure_category(str(error))
            skipped.append(
                _safe_failure(
                    source_id=anonymous_source_id,
                    category=category,
                )
            )

    if len(prepared) < 3:
        raise ValueError(
            "automatic preparation needs at least 3 safely coded matches after video/config "
            "and event-label validation; run the inspect command locally for private diagnostics"
        )

    source_keys = [str(item["sourceKey"]) for item in prepared]
    if split_lock_path is None:
        splits = _auto_split_names(len(prepared), seed)
        split_lock_report: dict[str, object] = {
            "status": "disabled",
            "file": None,
            "preservedCurrentMatches": 0,
            "newAssignments": {},
            "sourceMetadataAnonymized": True,
        }
    else:
        splits, split_lock_report = assign_locked_splits(
            source_keys,
            seed,
            split_lock_path,
            root,
        )

    matches: list[dict[str, Any]] = []
    auto_packages: list[dict[str, Any]] = []
    split_event_counts = {
        "train": Counter(),
        "validation": Counter(),
        "test": Counter(),
    }
    all_event_counts = Counter()
    for item, split in zip(prepared, splits, strict=True):
        anonymous_source_id = str(item["sourceKey"])
        match_id = match_id_for_source(anonymous_source_id)
        sanitized_segments = anonymize_segments(
            item["segments"],
            output_path,
            resolved_dataset_id,
            match_id,
        )
        sanitized_events = [sanitize_event(event) for event in item["events"]]
        matches.append(
            {
                "matchId": match_id,
                "split": split,
                "segments": sanitized_segments,
                "events": sanitized_events,
            }
        )
        auto_packages.append(
            {
                "matchId": match_id,
                "sourceId": anonymous_source_id,
                "split": split,
                "eventCounts": item["eventCounts"],
            }
        )
        split_event_counts[split].update(item["eventCounts"])
        all_event_counts.update(item["eventCounts"])

    manifest_json = {
        "version": 1,
        "datasetId": resolved_dataset_id,
        "privacy": {
            "sourceIdentity": "anonymized",
            "eventSourceMetadata": "removed",
            "videoPaths": "anonymous-local-symlinks",
        },
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
                "version": 2,
                "datasetId": manifest.dataset_id,
                "privacy": "Source paths, file names, team labels and source action names are excluded.",
                "eventTypes": list(EVENT_TYPES),
                "packages": auto_packages,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")

    failure_categories = Counter(
        str(item.get("category") or "other")
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
    report: dict[str, Any] = {
        "version": 2,
        "privacy": {
            "sourceIdentity": "anonymized",
            "rawPathsPersisted": False,
            "rawActionNamesPersisted": False,
        },
        "rootFingerprint": root_fingerprint(root),
        "timelineFilesFound": private_inspection.get("timelineFilesFound", 0),
        "usableSources": private_inspection.get("usableSources", 0),
        "unresolvedSources": private_inspection.get("unresolvedSources", 0),
        "eventTypes": list(EVENT_TYPES),
        "preparationFailures": skipped,
        "preparationFailureSummary": dict(sorted(failure_categories.items())),
        "missingEventTypeSummary": {
            event_type: missing_type_counts[event_type]
            for event_type in EVENT_TYPES
        },
        "missingEventCombinationSummary": dict(
            sorted(missing_combinations.items(), key=lambda item: (-item[1], item[0]))
        ),
        "preparedSources": len(matches),
        "preparedEventCounts": {
            event_type: all_event_counts[event_type]
            for event_type in EVENT_TYPES
        },
        "automaticSplit": {
            "seed": seed,
            "train": sum(1 for match in matches if match["split"] == "train"),
            "validation": sum(1 for match in matches if match["split"] == "validation"),
            "test": sum(1 for match in matches if match["split"] == "test"),
        },
        "splitLock": split_lock_report,
        "splitEventCounts": {
            split: {
                event_type: counts[event_type]
                for event_type in EVENT_TYPES
            }
            for split, counts in split_event_counts.items()
        },
        "productionQualificationReadyByMatchCount": (
            sum(1 for match in matches if match["split"] == "test") >= 5
        ),
        "manifestFile": output_path.name,
        "generatedSpecFile": auto_spec_path.name,
        "reportFile": report_path.name,
    }
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return manifest, report
