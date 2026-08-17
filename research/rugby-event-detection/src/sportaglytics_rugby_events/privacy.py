from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any


def root_fingerprint(root: Path) -> str:
    resolved = root.expanduser().resolve()
    return hashlib.sha256(str(resolved).encode("utf-8")).hexdigest()[:16]


def source_id(root: Path, package_root: Path) -> str:
    resolved_root = root.expanduser().resolve()
    resolved_package = package_root.expanduser().resolve()
    relative = resolved_package.relative_to(resolved_root).as_posix()
    digest = hashlib.sha256(
        f"{resolved_root}\0{relative}".encode("utf-8")
    ).hexdigest()[:16]
    return f"source-{digest}"


def source_id_from_relative(root: Path, relative_key: str) -> str:
    resolved_root = root.expanduser().resolve()
    digest = hashlib.sha256(
        f"{resolved_root}\0{relative_key}".encode("utf-8")
    ).hexdigest()[:16]
    return f"source-{digest}"


def match_id_for_source(source_identifier: str) -> str:
    digest = hashlib.sha256(source_identifier.encode("utf-8")).hexdigest()[:12]
    return f"match-{digest}"


def default_dataset_id(root: Path) -> str:
    return f"rugby-events-{root_fingerprint(root)[:12]}"


def sanitize_event(event: dict[str, Any]) -> dict[str, Any]:
    sanitized = {
        "eventType": event["eventType"],
        "anchorTimeSeconds": event["anchorTimeSeconds"],
        "endTimeSeconds": event.get("endTimeSeconds", event["anchorTimeSeconds"]),
    }
    return sanitized


def anonymize_segments(
    segments: list[dict[str, Any]],
    output_path: Path,
    dataset_id: str,
    match_id: str,
) -> list[dict[str, Any]]:
    link_root = output_path.parent / ".media-links" / dataset_id / match_id
    link_root.mkdir(parents=True, exist_ok=True)
    sanitized: list[dict[str, Any]] = []
    for index, segment in enumerate(segments, start=1):
        raw_path = segment.get("videoPath")
        if not isinstance(raw_path, str) or not raw_path.strip():
            raise ValueError("segment.videoPath must be a non-empty string")
        source_path = Path(raw_path).expanduser().resolve()
        suffix = source_path.suffix.casefold() or ".video"
        link_path = link_root / f"segment-{index:03d}{suffix}"
        if link_path.is_symlink():
            if link_path.resolve() != source_path:
                link_path.unlink()
        elif link_path.exists():
            raise FileExistsError(f"anonymous media link path is occupied: {link_path}")
        if not link_path.exists():
            link_path.symlink_to(source_path)
        sanitized.append(
            {
                "videoPath": str(link_path.absolute()),
                "timelineStartSeconds": segment["timelineStartSeconds"],
                "durationSeconds": segment["durationSeconds"],
            }
        )
    return sanitized


def safe_failure_reason(category: str) -> str:
    messages = {
        "missing-required-event-labels": "required event labels are incomplete",
        "unsupported-or-missing-config": "source config is unsupported or missing",
        "unresolved-video": "source video could not be resolved",
        "unsupported-or-invalid-timeline": "timeline data is unsupported or invalid",
        "other": "source preparation failed; use local inspect for private diagnostics",
    }
    return messages.get(category, messages["other"])
