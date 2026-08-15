from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.schema import (  # noqa: E402
    DatasetManifest,
    EventAnnotation,
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

    def test_event_annotation_preserves_possession_metadata(self) -> None:
        event = EventAnnotation.from_json(
            {
                "eventType": "scrum",
                "anchorTimeSeconds": 123.4,
                "possessionLabel": "帝京",
                "sourceActionName": "帝京 スクラム",
            }
        )

        self.assertEqual(event.event_type, "scrum")
        self.assertEqual(event.possession_label, "帝京")
        self.assertEqual(event.source_action_name, "帝京 スクラム")

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
