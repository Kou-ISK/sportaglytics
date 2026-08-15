from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.package_compat import (  # noqa: E402
    normalize_package_config,
)
from sportaglytics_rugby_events.sources import (  # noqa: E402
    _auto_split_names,
    discover_sources,
    inspection_report,
)


class SourceDiscoveryTest(unittest.TestCase):
    def test_discovers_current_legacy_and_unresolved_timeline_roots(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)

            current = root / "current-match"
            (current / ".metadata").mkdir(parents=True)
            (current / "timeline.json").write_text(
                json.dumps(
                    [
                        {"actionName": "帝京 スクラム", "startTime": 12.0},
                        {"actionName": "帝京 スクラム", "startTime": 40.0},
                        {"actionName": "相手 ラインアウト", "startTime": 65.0},
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            (current / ".metadata" / "config.json").write_text(
                json.dumps(
                    {
                        "angles": [
                            {
                                "id": "primary",
                                "sourceKind": "local",
                                "relativePath": "videos/main.mp4",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            legacy = root / "legacy-match"
            legacy.mkdir()
            (legacy / "timeline.json").write_text("[]", encoding="utf-8")
            (legacy / "config.json").write_text(
                json.dumps({"tightViewPath": "videos/legacy.mp4"}),
                encoding="utf-8",
            )

            unknown = root / "unknown-match"
            unknown.mkdir()
            (unknown / "timeline.json").write_text("[]", encoding="utf-8")

            sources = discover_sources(root)
            self.assertEqual(len(sources), 3)
            by_name = {source.package_root.name: source for source in sources}
            self.assertTrue(by_name["current-match"].usable)
            self.assertEqual(by_name["current-match"].config_format, "angles")
            self.assertTrue(by_name["legacy-match"].usable)
            self.assertEqual(by_name["legacy-match"].config_format, "legacy-tight-wide")
            self.assertFalse(by_name["unknown-match"].usable)

            report = inspection_report(root)
            self.assertEqual(report["timelineFilesFound"], 3)
            self.assertEqual(report["usableSources"], 2)
            self.assertEqual(report["unresolvedSources"], 1)
            self.assertEqual(report["actionNameCounts"]["帝京 スクラム"], 2)

    def test_automatic_split_is_deterministic_and_match_level(self) -> None:
        first = _auto_split_names(8, 42)
        second = _auto_split_names(8, 42)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 8)
        self.assertIn("train", first)
        self.assertIn("validation", first)
        self.assertIn("test", first)

    def test_automatic_split_reserves_five_test_matches_when_dataset_allows_it(self) -> None:
        splits = _auto_split_names(12, 42)
        self.assertEqual(splits.count("test"), 5)
        self.assertGreaterEqual(splits.count("train"), 1)
        self.assertGreaterEqual(splits.count("validation"), 1)

    def test_legacy_tight_wide_config_is_normalized_in_memory(self) -> None:
        original = {
            "tightViewPath": "videos/tight.mp4",
            "wideViewPath": "videos/wide.mp4",
        }
        normalized = normalize_package_config(original)
        self.assertNotIn("angles", original)
        self.assertEqual(len(normalized["angles"]), 2)
        self.assertEqual(normalized["primaryAngleId"], "legacy-angle-1")
        self.assertEqual(normalized["angles"][0]["relativePath"], "videos/tight.mp4")
        self.assertEqual(normalized["angles"][1]["relativePath"], "videos/wide.mp4")


if __name__ == "__main__":
    unittest.main()
