from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def find_package_config_path(package_root: Path) -> Path | None:
    for candidate in (
        package_root / ".metadata" / "config.json",
        package_root / "config.json",
    ):
        if candidate.is_file():
            return candidate
    return None


def _source_kind(value: str) -> str:
    return "youtube" if re.match(r"^https://", value.strip(), re.IGNORECASE) else "local"


def _resolve_legacy_local_path(package_root: Path | None, value: str) -> str:
    if package_root is None:
        return value
    source = Path(value).expanduser()
    direct = source if source.is_absolute() else package_root / source
    if direct.is_file():
        return str(source if source.is_absolute() else source.as_posix())

    videos_dir = package_root / "videos"
    fallback = videos_dir / source.name
    if fallback.is_file():
        return fallback.relative_to(package_root).as_posix()
    if videos_dir.is_dir():
        matched = next(
            (
                candidate
                for candidate in videos_dir.iterdir()
                if candidate.is_file() and candidate.name.casefold() == source.name.casefold()
            ),
            None,
        )
        if matched is not None:
            return matched.relative_to(package_root).as_posix()
    return value


def normalize_package_config(
    config: dict[str, Any],
    package_root: Path | None = None,
) -> dict[str, Any]:
    """Return a research-only normalized view without mutating source files.

    Current packages already expose ``angles[]``. Older SporTagLytics packages
    used ``tightViewPath`` / ``wideViewPath`` instead; reproduce the application's
    load-time migration in memory so research can consume those packages directly.
    Broken historical absolute paths are conservatively recovered by basename from
    the package's ``videos`` directory when the file is present there.
    """

    raw_angles = config.get("angles")
    if isinstance(raw_angles, list) and raw_angles:
        return config

    legacy_sources = [
        value.strip()
        for key in ("tightViewPath", "wideViewPath")
        if isinstance((value := config.get(key)), str) and value.strip()
    ]
    if not legacy_sources:
        return config

    normalized = dict(config)
    angles: list[dict[str, Any]] = []
    for index, source in enumerate(legacy_sources, start=1):
        source_kind = _source_kind(source)
        resolved_source = (
            source
            if source_kind == "youtube"
            else _resolve_legacy_local_path(package_root, source)
        )
        angle_id = f"legacy-angle-{index}"
        source_fields = (
            {"sourceUrl": resolved_source}
            if source_kind == "youtube"
            else {"relativePath": resolved_source}
        )
        angles.append(
            {
                "id": angle_id,
                "name": f"Legacy Angle {index}",
                "role": "primary" if index == 1 else "secondary",
                "sourceKind": source_kind,
                **source_fields,
                "clips": [
                    {
                        "id": f"{angle_id}-clip-1",
                        "sourceKind": source_kind,
                        **source_fields,
                        "timelineStartSeconds": 0,
                    }
                ],
            }
        )
    normalized["angles"] = angles
    normalized["primaryAngleId"] = "legacy-angle-1"
    if len(angles) > 1:
        normalized["secondaryAngleId"] = "legacy-angle-2"
    return normalized
