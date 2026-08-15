from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from .schema import EVENT_TYPES, DatasetManifest
from .video import probe_video_duration


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _normalize_action_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def _load_aliases(path: Path) -> dict[str, set[str]]:
    raw = _load_json(path)
    if not isinstance(raw, dict):
        raise ValueError("event aliases must be an object")
    result: dict[str, set[str]] = {}
    for event_type in EVENT_TYPES:
        values = raw.get(event_type)
        if not isinstance(values, list) or not values:
            raise ValueError(f"aliases for {event_type} must be a non-empty array")
        result[event_type] = {
            _normalize_action_name(value)
            for value in values
            if isinstance(value, str) and value.strip()
        }
    return result


def _event_anchor_offsets(value: Any, label: str) -> dict[str, float]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object keyed by event type")
    result: dict[str, float] = {}
    for event_type, raw_offset in value.items():
        if event_type not in EVENT_TYPES:
            raise ValueError(f"{label} contains unsupported event type: {event_type}")
        if (
            not isinstance(raw_offset, (int, float))
            or isinstance(raw_offset, bool)
            or not math.isfinite(float(raw_offset))
            or float(raw_offset) < 0
        ):
            raise ValueError(f"{label}.{event_type} must be a finite number >= 0")
        result[event_type] = float(raw_offset)
    return result


def _timeline_instances(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict) and raw.get("version") == 2:
        instances = raw.get("instances")
        if isinstance(instances, list):
            return [item for item in instances if isinstance(item, dict)]
    raise ValueError("timeline.json must be a legacy array or TimelineDocument v2")


def _select_angle(config: dict[str, Any], requested_angle_id: str | None) -> dict[str, Any]:
    raw_angles = config.get("angles")
    if not isinstance(raw_angles, list):
        raise ValueError("package config has no angles[]")
    angles = [item for item in raw_angles if isinstance(item, dict)]
    if not angles:
        raise ValueError("package config has no valid angles")

    preferred_ids = [
        requested_angle_id,
        config.get("primaryAngleId") if isinstance(config.get("primaryAngleId"), str) else None,
    ]
    for preferred_id in preferred_ids:
        if not preferred_id:
            continue
        match = next(
            (
                angle
                for angle in angles
                if angle.get("id") == preferred_id and angle.get("sourceKind") != "youtube"
            ),
            None,
        )
        if match is not None:
            return match

    role_primary = next(
        (
            angle
            for angle in angles
            if angle.get("role") == "primary" and angle.get("sourceKind") != "youtube"
        ),
        None,
    )
    if role_primary is not None:
        return role_primary

    local_angle = next(
        (angle for angle in angles if angle.get("sourceKind") != "youtube"),
        None,
    )
    if local_angle is None:
        raise ValueError("research dataset requires at least one local video angle")
    return local_angle


def _segments_for_angle(package_root: Path, angle: dict[str, Any]) -> list[dict[str, Any]]:
    raw_clips = angle.get("clips")
    if not isinstance(raw_clips, list) or not raw_clips:
        raw_clips = [
            {
                "sourceKind": angle.get("sourceKind"),
                "relativePath": angle.get("relativePath"),
                "timelineStartSeconds": 0,
            }
        ]

    segments: list[dict[str, Any]] = []
    for clip in raw_clips:
        if not isinstance(clip, dict) or clip.get("sourceKind") == "youtube":
            continue
        relative_path = clip.get("relativePath")
        if not isinstance(relative_path, str) or not relative_path.strip():
            continue
        source_path = Path(relative_path)
        video_path = source_path if source_path.is_absolute() else package_root / source_path
        video_path = video_path.resolve()
        if not video_path.is_file():
            raise FileNotFoundError(f"video clip does not exist: {video_path}")

        raw_duration = clip.get("durationSeconds")
        duration = (
            float(raw_duration)
            if isinstance(raw_duration, (int, float)) and float(raw_duration) > 0
            else probe_video_duration(video_path)
        )
        raw_start = clip.get("timelineStartSeconds", 0)
        timeline_start = float(raw_start) if isinstance(raw_start, (int, float)) else 0.0
        segments.append(
            {
                "videoPath": str(video_path),
                "timelineStartSeconds": max(0.0, timeline_start),
                "durationSeconds": duration,
            }
        )

    if not segments:
        raise ValueError("selected angle has no local video clips")
    return sorted(segments, key=lambda item: item["timelineStartSeconds"])


def _event_annotations(
    instances: list[dict[str, Any]],
    aliases: dict[str, set[str]],
    anchor_offsets: dict[str, float],
) -> list[dict[str, Any]]:
    lookup = {
        alias: event_type
        for event_type, event_aliases in aliases.items()
        for alias in event_aliases
    }
    events: list[dict[str, Any]] = []
    for instance in instances:
        action_name = instance.get("actionName")
        start_time = instance.get("startTime")
        if not isinstance(action_name, str) or not isinstance(start_time, (int, float)):
            continue
        event_type = lookup.get(_normalize_action_name(action_name))
        if event_type is None:
            continue
        # Timeline startTime can intentionally include Code Window lead padding.
        # The dataset spec can add that lead back to recover the analyst's
        # original button-press/event-onset anchor without mutating source data.
        anchor_time = float(start_time) + anchor_offsets.get(event_type, 0.0)
        events.append(
            {
                "eventType": event_type,
                "anchorTimeSeconds": max(0.0, anchor_time),
            }
        )
    return sorted(events, key=lambda item: item["anchorTimeSeconds"])


def build_manifest(
    spec_path: Path,
    aliases_path: Path,
    output_path: Path,
) -> DatasetManifest:
    spec = _load_json(spec_path)
    if not isinstance(spec, dict) or spec.get("version") != 1:
        raise ValueError("dataset spec version must be 1")
    raw_packages = spec.get("packages")
    if not isinstance(raw_packages, list) or not raw_packages:
        raise ValueError("dataset spec packages must be a non-empty array")

    aliases = _load_aliases(aliases_path)
    default_anchor_offsets = _event_anchor_offsets(
        spec.get("eventAnchorOffsetsSeconds"),
        "eventAnchorOffsetsSeconds",
    )
    manifest_matches: list[dict[str, Any]] = []
    seen_match_ids: set[str] = set()

    for item in raw_packages:
        if not isinstance(item, dict):
            raise ValueError("each dataset spec package must be an object")
        package_value = item.get("packagePath")
        match_id = item.get("matchId")
        split = item.get("split")
        if not isinstance(package_value, str) or not package_value.strip():
            raise ValueError("packagePath is required")
        if not isinstance(match_id, str) or not match_id.strip():
            raise ValueError("matchId is required")
        if match_id in seen_match_ids:
            raise ValueError(f"duplicate matchId: {match_id}")
        if split not in ("train", "validation", "test"):
            raise ValueError(f"invalid split for {match_id}: {split}")
        seen_match_ids.add(match_id)

        package_root = Path(package_value).expanduser().resolve()
        config_path = package_root / ".metadata" / "config.json"
        timeline_path = package_root / "timeline.json"
        if not config_path.is_file() or not timeline_path.is_file():
            raise FileNotFoundError(
                f"{match_id}: package requires .metadata/config.json and timeline.json"
            )

        config = _load_json(config_path)
        if not isinstance(config, dict):
            raise ValueError(f"{match_id}: invalid package config")
        timeline = _timeline_instances(_load_json(timeline_path))
        requested_angle_id = item.get("angleId")
        angle = _select_angle(
            config,
            requested_angle_id if isinstance(requested_angle_id, str) else None,
        )
        package_anchor_offsets = dict(default_anchor_offsets)
        package_anchor_offsets.update(
            _event_anchor_offsets(
                item.get("eventAnchorOffsetsSeconds"),
                f"packages[{match_id}].eventAnchorOffsetsSeconds",
            )
        )
        manifest_matches.append(
            {
                "matchId": match_id,
                "split": split,
                "angleId": angle.get("id"),
                "segments": _segments_for_angle(package_root, angle),
                "events": _event_annotations(
                    timeline,
                    aliases,
                    package_anchor_offsets,
                ),
            }
        )

    manifest_json = {
        "version": 1,
        "datasetId": str(spec.get("datasetId") or spec_path.stem),
        "matches": manifest_matches,
    }
    manifest = DatasetManifest.from_json(manifest_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest_json, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return manifest
