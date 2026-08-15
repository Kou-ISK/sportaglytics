from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.arguments import normalize_forwarded_args  # noqa: E402


class ForwardedArgumentsTest(unittest.TestCase):
    def test_removes_pnpm_separator_after_subcommand(self) -> None:
        self.assertEqual(
            normalize_forwarded_args(
                [
                    "inspect",
                    "--",
                    "--root",
                    "/tmp/data",
                    "--output",
                    "/tmp/report.json",
                ]
            ),
            [
                "inspect",
                "--root",
                "/tmp/data",
                "--output",
                "/tmp/report.json",
            ],
        )

    def test_preserves_normal_forwarded_arguments(self) -> None:
        args = ["prepare", "--root", "/tmp/data", "--output", "/tmp/manifest.json"]
        self.assertEqual(normalize_forwarded_args(args), args)


if __name__ == "__main__":
    unittest.main()
