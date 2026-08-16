from __future__ import annotations

import sys
from pathlib import Path
import tempfile
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.sources import _auto_split_names  # noqa: E402
from sportaglytics_rugby_events.split_lock import assign_locked_splits  # noqa: E402


class SplitLockTest(unittest.TestCase):
    def test_existing_assignments_do_not_change_when_matches_are_added(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            lock_path = root / "split-lock.json"
            initial_keys = [f"match-{index}" for index in range(7)]
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

            expanded_keys = [*initial_keys, *(f"new-{index}" for index in range(5))]
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
            keys = [f"match-{index}" for index in range(7)]
            assign_locked_splits(keys, 42, lock_path, root)

            with self.assertRaisesRegex(ValueError, "seed"):
                assign_locked_splits(keys, 7, lock_path, root)


if __name__ == "__main__":
    unittest.main()
