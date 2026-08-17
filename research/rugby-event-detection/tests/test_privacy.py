from __future__ import annotations

import json
import sys
from pathlib import Path
import tempfile
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.privacy import (  # noqa: E402
    anonymize_segments,
    default_dataset_id,
    match_id_for_source,
    sanitize_event,
    source_id,
)


class ResearchPrivacyTest(unittest.TestCase):
    def test_source_and_dataset_ids_do_not_embed_source_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "private-rugby-data"
            package_root = root / "season-a" / "match-private-alpha-v-beta"
            package_root.mkdir(parents=True)

            anonymous_source = source_id(root, package_root)
            anonymous_match = match_id_for_source(anonymous_source)
            dataset_id = default_dataset_id(root)

            combined = " ".join((anonymous_source, anonymous_match, dataset_id))
            self.assertNotIn("private-rugby-data", combined)
            self.assertNotIn("match-private-alpha-v-beta", combined)
            self.assertTrue(anonymous_source.startswith("source-"))
            self.assertTrue(anonymous_match.startswith("match-"))
            self.assertTrue(dataset_id.startswith("rugby-events-"))

    def test_event_source_labels_are_removed_from_training_manifest_event(self) -> None:
        event = {
            "eventType": "scrum",
            "anchorTimeSeconds": 10.0,
            "endTimeSeconds": 18.0,
            "possessionLabel": "private-team-alpha",
            "sourceActionName": "private-team-alpha scrum",
        }

        sanitized = sanitize_event(event)
        serialized = json.dumps(sanitized, ensure_ascii=False)

        self.assertEqual(
            sanitized,
            {
                "eventType": "scrum",
                "anchorTimeSeconds": 10.0,
                "endTimeSeconds": 18.0,
            },
        )
        self.assertNotIn("private-team-alpha", serialized)
        self.assertNotIn("possessionLabel", serialized)
        self.assertNotIn("sourceActionName", serialized)

    def test_manifest_video_path_uses_anonymous_symlink_name(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temp_root = Path(directory)
            source_dir = temp_root / "private-rugby-data" / "match-private-alpha-v-beta"
            source_dir.mkdir(parents=True)
            source_video = source_dir / "match-private-alpha-v-beta-tight.mp4"
            source_video.write_bytes(b"test")
            output_path = temp_root / "public-output" / "manifest.json"
            output_path.parent.mkdir(parents=True)

            sanitized = anonymize_segments(
                [
                    {
                        "videoPath": str(source_video),
                        "timelineStartSeconds": 0.0,
                        "durationSeconds": 60.0,
                    }
                ],
                output_path,
                "rugby-events-deadbeef",
                "match-deadbeef0001",
            )

            persisted_path = Path(sanitized[0]["videoPath"])
            serialized = json.dumps(sanitized, ensure_ascii=False)
            self.assertTrue(persisted_path.is_symlink())
            self.assertEqual(persisted_path.resolve(), source_video.resolve())
            self.assertNotIn("private-rugby-data", serialized)
            self.assertNotIn("match-private-alpha-v-beta", serialized)
            self.assertEqual(persisted_path.name, "segment-001.mp4")


if __name__ == "__main__":
    unittest.main()
