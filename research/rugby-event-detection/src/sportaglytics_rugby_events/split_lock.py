from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
from typing import Any

from .sources import _auto_split_names

VALID_SPLITS = {"train", "validation", "test"}


def source_key(root: Path, package_root: Path) -> str:
    root = root.expanduser().resolve()
    package_root = package_root.expanduser().resolve()
    return package_root.relative_to(root).as_posix()


def default_split_lock_path(root: Path) -> Path:
    root = root.expanduser().resolve()
    research_root = Path(__file__).resolve().parents[2]
    digest = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:16]
    readable = root.name or "rugby-events"
    return research_root / "runs" / ".split-locks" / f"{readable}-{digest}.json"


def _stable_new_key_order(keys: list[str], seed: int) -> list[str]:
    return sorted(
        keys,
        key=lambda key: hashlib.sha256(f"{seed}\0{key}".encode("utf-8")).hexdigest(),
    )


def _read_lock(path: Path, root: Path, seed: int) -> dict[str, str]:
    with path.open("r", encoding="utf-8") as handle:
        raw: Any = json.load(handle)
    if not isinstance(raw, dict) or raw.get("version") != 1:
        raise ValueError(f"split lock has unsupported format: {path}")
    if raw.get("sourceRoot") != str(root):
        raise ValueError(
            "split lock sourceRoot does not match the requested dataset root; "
            f"lock={raw.get('sourceRoot')!r}, requested={str(root)!r}"
        )
    if raw.get("seed") != seed:
        raise ValueError(
            "split lock seed does not match the requested seed; changing the seed after "
            "development has started would invalidate held-out Test provenance"
        )
    assignments_raw = raw.get("assignments")
    if not isinstance(assignments_raw, dict):
        raise ValueError("split lock assignments must be an object")
    assignments: dict[str, str] = {}
    for key, split in assignments_raw.items():
        if not isinstance(key, str) or not key:
            raise ValueError("split lock contains an invalid source key")
        if split not in VALID_SPLITS:
            raise ValueError(f"split lock contains invalid split for {key}: {split!r}")
        assignments[key] = split
    return assignments


def _write_lock(
    path: Path,
    root: Path,
    seed: int,
    assignments: dict[str, str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "sourceRoot": str(root),
        "seed": seed,
        "policy": (
            "Existing source assignments are immutable. When safely coded matches are added, "
            "only new sources are assigned to Test/Validation deficits; remaining new sources "
            "become Train. This prevents previously used development matches from becoming Test."
        ),
        "assignments": dict(sorted(assignments.items())),
    }
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def assign_locked_splits(
    source_keys: list[str],
    seed: int,
    lock_path: Path,
    root: Path,
) -> tuple[list[str], dict[str, object]]:
    if len(source_keys) != len(set(source_keys)):
        raise ValueError("split source keys must be unique")
    if len(source_keys) < 3:
        raise ValueError("automatic dataset preparation requires at least 3 usable matches")

    root = root.expanduser().resolve()
    lock_path = lock_path.expanduser().resolve()
    lock_existed = lock_path.is_file()
    assignments = _read_lock(lock_path, root, seed) if lock_existed else {}

    current_locked = {
        key: assignments[key]
        for key in source_keys
        if key in assignments
    }
    new_keys = [key for key in source_keys if key not in assignments]

    if not lock_existed:
        # The first lock deliberately reproduces the pre-lock splitter exactly. Running
        # prepare once on an already-used dataset therefore freezes the same assignments
        # rather than silently moving an old Train/Validation match into Test.
        initial_splits = _auto_split_names(len(source_keys), seed)
        for key, split in zip(source_keys, initial_splits, strict=True):
            assignments[key] = split
        new_assignments = dict(zip(source_keys, initial_splits, strict=True))
        status = "created"
    else:
        target_counts = Counter(_auto_split_names(len(source_keys), seed))
        current_counts = Counter(current_locked.values())
        test_deficit = max(0, target_counts["test"] - current_counts["test"])
        validation_deficit = max(
            0,
            target_counts["validation"] - current_counts["validation"],
        )
        new_assignments: dict[str, str] = {}
        for key in _stable_new_key_order(new_keys, seed):
            if test_deficit > 0:
                split = "test"
                test_deficit -= 1
            elif validation_deficit > 0:
                split = "validation"
                validation_deficit -= 1
            else:
                split = "train"
            assignments[key] = split
            new_assignments[key] = split
        status = "updated" if new_assignments else "reused"

    _write_lock(lock_path, root, seed, assignments)
    resolved = [assignments[key] for key in source_keys]
    counts = Counter(resolved)
    report: dict[str, object] = {
        "path": str(lock_path),
        "status": status,
        "preservedCurrentMatches": len(current_locked),
        "newAssignments": dict(sorted(new_assignments.items())),
        "currentCounts": {
            "train": counts["train"],
            "validation": counts["validation"],
            "test": counts["test"],
        },
    }
    return resolved, report
