from __future__ import annotations

import json
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .package_compat import find_package_config_path

IGNORED_DIRECTORY_NAMES = {
    ".git",
    ".venv",
    "node_modules",
    "runs",
    "dist",
    "build",
}
VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".webm",
}


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _is_ignored(path: Path, root: Path) -> bool:
    try:
        relative_parts = path.relative_to(root).parts
    except ValueError:
        return True
    return any(part in IGNORED_DIRECTORY_NAMES for part in relative_parts)


def _timeline_summary(path: Path) -> tuple[str, list[dict[str, Any]], str | None]:
    try:
        raw = _load_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return "invalid", [], str(error)
    if isinstance(raw, list):
        return "legacy-array", [item for item in raw if isinstance(item, dict)], None
    if isinstance(raw, dict) and raw.get("version") == 2 and isinstance(raw.get("instances"), list):
        return (
            "timeline-v2",
            [item for item in raw["instances"] if isinstance(item, dict)],
            None,
        )
    return "unknown", [], "timeline.json is neither a legacy array nor TimelineDocument v2"


def _config_summary(path: Path | None) -> tuple[str, list[str], str | None]:
    if path is None:
        return "missing", [], "config.json was not found"
    try:
        raw = _load_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return "invalid", [], str(error)
    if not isinstance(raw, dict):
        return "invalid", [], "config root is not an object"
    keys = sorted(str(key) for key in raw.keys())
    angles = raw.get("angles")
    if isinstance(angles, list) and angles:
        return "angles", keys, None
    if any(
        isinstance(raw.get(key), str) and raw.get(key).strip()
        for key in ("tightViewPath", "wideViewPath")
    ):
        return "legacy-tight-wide", keys, None
    return "unknown", keys, "config has neither angles[] nor tightViewPath/wideViewPath"


def _video_candidates(package_root: Path) -> list[str]:
    candidates: list[str] = []
    for path in package_root.rglob("*"):
        if not path.is_file() or path.suffix.casefold() not in VIDEO_EXTENSIONS:
            continue
        if any(part in IGNORED_DIRECTORY_NAMES for part in path.relative_to(package_root).parts):
            continue
        candidates.append(str(path.resolve()))
    return sorted(candidates)


def _action_name_counts(instances: list[dict[str, Any]]) -> dict[str, int]:
    counts = Counter(
        value.strip()
        for item in instances
        if isinstance((value := item.get("actionName")), str) and value.strip()
    )
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold())))


def _nearby_files(package_root: Path) -> list[str]:
    result: list[str] = []
    for path in package_root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(package_root)
        if len(relative.parts) > 3:
            continue
        if any(part in IGNORED_DIRECTORY_NAMES for part in relative.parts):
            continue
        result.append(str(relative))
    return sorted(result)[:200]


@dataclass(frozen=True)
class DiscoveredSource:
    package_root: Path
    timeline_path: Path
    config_path: Path | None
    timeline_format: str
    config_format: str
    action_name_counts: dict[str, int]
    video_candidates: tuple[str, ...]
    nearby_files: tuple[str, ...]
    config_keys: tuple[str, ...]
    usable: bool
    issues: tuple[str, ...]

    def to_json(self) -> dict[str, Any]:
        return {
            "packageRoot": str(self.package_root),
            "timelinePath": str(self.timeline_path),
            "timelineFormat": self.timeline_format,
            "configPath": str(self.config_path) if self.config_path is not None else None,
            "configFormat": self.config_format,
            "configKeys": list(self.config_keys),
            "usable": self.usable,
            "issues": list(self.issues),
            "actionNameCounts": self.action_name_counts,
            "videoCandidates": list(self.video_candidates),
            "nearbyFiles": list(self.nearby_files),
        }


def discover_sources(root: Path) -> tuple[DiscoveredSource, ...]:
    root = root.expanduser().resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"source root does not exist or is not a directory: {root}")
    timeline_paths = sorted(
        path
        for path in root.rglob("timeline.json")
        if path.is_file() and not _is_ignored(path, root)
    )
    sources: list[DiscoveredSource] = []
    for timeline_path in timeline_paths:
        package_root = timeline_path.parent.resolve()
        timeline_format, instances, timeline_issue = _timeline_summary(timeline_path)
        config_path = find_package_config_path(package_root)
        config_format, config_keys, config_issue = _config_summary(config_path)
        issues = [issue for issue in (timeline_issue, config_issue) if issue is not None]
        usable = timeline_format in {"legacy-array", "timeline-v2"} and config_format in {
            "angles",
            "legacy-tight-wide",
        }
        sources.append(
            DiscoveredSource(
                package_root=package_root,
                timeline_path=timeline_path.resolve(),
                config_path=config_path.resolve() if config_path is not None else None,
                timeline_format=timeline_format,
                config_format=config_format,
                action_name_counts=_action_name_counts(instances),
                video_candidates=tuple(_video_candidates(package_root)),
                nearby_files=tuple(_nearby_files(package_root)),
                config_keys=tuple(config_keys),
                usable=usable,
                issues=tuple(issues),
            )
        )
    return tuple(sources)


def inspection_report(root: Path) -> dict[str, Any]:
    sources = discover_sources(root)
    aggregate_actions = Counter()
    for source in sources:
        aggregate_actions.update(source.action_name_counts)
    return {
        "root": str(root.expanduser().resolve()),
        "timelineFilesFound": len(sources),
        "usableSources": sum(1 for source in sources if source.usable),
        "unresolvedSources": sum(1 for source in sources if not source.usable),
        "actionNameCounts": dict(
            sorted(aggregate_actions.items(), key=lambda item: (-item[1], item[0].casefold()))
        ),
        "sources": [source.to_json() for source in sources],
    }


def write_inspection_report(root: Path, output_path: Path | None) -> dict[str, Any]:
    report = inspection_report(root)
    if output_path is not None:
        output_path = output_path.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    return report


def _auto_split_names(count: int, seed: int) -> list[str]:
    if count < 3:
        raise ValueError("automatic dataset preparation requires at least 3 usable matches")
    validation_count = max(1, round(count * 0.2))
    test_count = 5 if count >= 12 else max(1, round(count * 0.2))
    while count - validation_count - test_count < 1:
        if validation_count > 1:
            validation_count -= 1
        elif test_count > 1:
            test_count -= 1
        else:
            break
    splits = (
        ["test"] * test_count
        + ["validation"] * validation_count
        + ["train"] * (count - test_count - validation_count)
    )
    random.Random(seed).shuffle(splits)
    return splits
