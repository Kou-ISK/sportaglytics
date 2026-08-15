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


def normalize_package_config(config: dict[str, Any]) -> dict[str, Any]:
    """Return a research-only normalized view without mutating source files.

    Current packages already expose ``angles[]``. Older SporTagLytics packages
    used ``tightViewPath`` / ``wideViewPath`` instead; reproduce the application's
    load-time migration in memory so research can consume those packages directly.
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
        angle_id = f"legacy-angle-{index}"
        source_fields = (
            {"sourceUrl": source}
            if source_kind == "youtube"
            else {"relativePath": source}
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
