from __future__ import annotations

import json
import sys
from pathlib import Path
import tempfile
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.privacy import source_id_from_relative  # noqa: E402
from sportaglytics_rugby_events.sources import _auto_split_names  # noqa: E402
from sportaglytics_rugby_events.split_lock import assign_locked_splits  # noqa: E402


def anonymous_keys(count: int) -> list[str]:
    return [f"source-{index:016x}" for index in range(count)]


class SplitLockTest(unittest.TestCase):
    def test_existing_assignments_do_not_change_when_matches_are_added(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            lock_path = root / "split-lock.json"
            initial_keys = anonymous_keys(7)
            initial_splits, initial_report = assign_locked_splits(
                initial_keys,
                42,
                lock_path,
                root,
            )
            self.assertEqual(initial_report["status"], "created")
            self.assertEqual(initial_splits, _auto_split_names(7, 42))
            self.assertEqual(initial_splits.count("train"), 4)
            self.assertEqual(initial_splits.count("validation"), 2)
            self.assertEqual(initial_splits.count("test"), 1)

            expanded_keys = [*initial_keys, *anonymous_keys(12)[7:]]
            expanded_splits, expanded_report = assign_locked_splits(
                expanded_keys,
                42,
                lock_path,
                root,
            )

            self.assertEqual(expanded_report["status"], "updated")
            self.assertEqual(expanded_splits[:7], initial_splits)
            self.assertEqual(expanded_splits.count("train"), 5)
            self.assertEqual(expanded_splits.count("validation"), 2)
            self.assertEqual(expanded_splits.count("test"), 5)

    def test_lock_rejects_seed_change(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            lock_path = root / "split-lock.json"
            keys = anonymous_keys(7)
            assign_locked_splits(keys, 42, lock_path, root)

            with self.assertRaisesRegex(ValueError, "seed"):
                assign_locked_splits(keys, 7, lock_path, root)

    def test_legacy_lock_is_migrated_without_persisting_team_names_or_root_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            lock_path = root / "split-lock.json"
            raw_keys = [
                "2025シーズン/20251012 帝京v昭和",
                "2025シーズン/20251026 帝京v自治医",
                "2026シーズン/20260812 帝京v愛知教育.stpkg",
            ]
            with lock_path.open("w", encoding="utf-8") as handle:
                json.dump(
                    {
                        "version": 1,
                        "sourceRoot": str(root),
                        "seed": 42,
                        "assignments": {
                            raw_keys[0]: "validation",
                            raw_keys[1]: "train",
                            raw_keys[2]: "test",
                        },
                    },
                    handle,
                    ensure_ascii=False,
                )

            keys = [source_id_from_relative(root, key) for key in raw_keys]
            splits, report = assign_locked_splits(keys, 42, lock_path, root)

            self.assertEqual(report["status"], "migrated")
            self.assertEqual(splits, ["validation", "train", "test"])
            persisted = lock_path.read_text(encoding="utf-8")
            self.assertNotIn("帝京", persisted)
            self.assertNotIn(str(root), persisted)
            self.assertIn('"version": 2', persisted)
            self.assertTrue(all(key.startswith("source-") for key in keys))


if __name__ == "__main__":
    unittest.main()
