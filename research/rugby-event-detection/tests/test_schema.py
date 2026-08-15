from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.schema import (  # noqa: E402
    DatasetManifest,
    ModelCandidate,
)


class SchemaTest(unittest.TestCase):
    def test_production_eligibility_requires_boolean(self) -> None:
        with self.assertRaisesRegex(ValueError, "productionEligible"):
            ModelCandidate.from_json(
                {
                    "id": "bad-model",
                    "family": "pytorchvideo",
                    "checkpoint": "x3d_s",
                    "license": "Apache-2.0",
                    "productionEligible": "false",
                    "numFrames": 13,
                    "clipDurationSeconds": 2.6,
                }
            )

    def test_dataset_requires_train_validation_and_test_splits(self) -> None:
        base_match = {
            "segments": [
                {
                    "videoPath": "/tmp/video.mp4",
                    "timelineStartSeconds": 0,
                    "durationSeconds": 30,
                }
            ],
            "events": [],
        }
        with self.assertRaisesRegex(ValueError, "train split"):
            DatasetManifest.from_json(
                {
                    "version": 1,
                    "datasetId": "missing-train",
                    "matches": [
                        {
                            **base_match,
                            "matchId": "validation-1",
                            "split": "validation",
                        },
                        {
                            **base_match,
                            "matchId": "test-1",
                            "split": "test",
                        },
                    ],
                }
            )


if __name__ == "__main__":
    unittest.main()
