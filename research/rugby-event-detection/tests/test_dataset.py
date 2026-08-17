from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.dataset import (  # noqa: E402
    build_negative_candidate_pool,
    build_positive_samples,
)
from sportaglytics_rugby_events.schema import (  # noqa: E402
    DatasetManifest,
    EventAnnotation,
    MatchManifest,
    TimelineSegment,
)


def make_match(event: EventAnnotation) -> MatchManifest:
    return MatchManifest(
        match_id="match-1",
        split="train",
        segments=(
            TimelineSegment(
                video_path=Path("/tmp/match-1.mp4"),
                timeline_start_seconds=0,
                duration_seconds=60,
            ),
        ),
        events=(event,),
    )


class DatasetSamplingTest(unittest.TestCase):
    def test_positive_sampling_uses_early_part_of_coded_interval(self) -> None:
        match = make_match(
            EventAnnotation(
                event_type="restart",
                anchor_time_seconds=10,
                end_time_seconds=30,
            )
        )

        samples = build_positive_samples(
            (match,),
            clip_duration_seconds=2.6,
            samples_per_event=2,
            positive_span_seconds=8.0,
        )

        self.assertEqual(len(samples), 2)
        self.assertAlmostEqual(samples[0].global_center_seconds, 10.0)
        self.assertAlmostEqual(samples[1].global_center_seconds, 14.0)
        self.assertTrue(all(sample.event_type == "restart" for sample in samples))

    def test_point_annotation_still_creates_one_positive_sample(self) -> None:
        match = make_match(
            EventAnnotation(
                event_type="scrum",
                anchor_time_seconds=20,
            )
        )

        samples = build_positive_samples(
            (match,),
            clip_duration_seconds=2.6,
            samples_per_event=2,
            positive_span_seconds=8.0,
        )

        self.assertEqual(len(samples), 1)
        self.assertAlmostEqual(samples[0].global_center_seconds, 20.0)

    def test_negative_pool_excludes_full_coded_interval_and_margin(self) -> None:
        match = make_match(
            EventAnnotation(
                event_type="restart",
                anchor_time_seconds=10,
                end_time_seconds=30,
            )
        )
        manifest = DatasetManifest(dataset_id="test", matches=(match,))

        samples = build_negative_candidate_pool(
            manifest,
            split="train",
            clip_duration_seconds=2.0,
            exclusion_seconds=5.0,
        )

        centers = [sample.global_center_seconds for sample in samples]
        self.assertTrue(centers)
        self.assertTrue(all(center <= 5.0 or center >= 35.0 for center in centers))
        self.assertFalse(any(10.0 <= center <= 30.0 for center in centers))
        self.assertTrue(all(sample.event_type == "other" for sample in samples))


if __name__ == "__main__":
    unittest.main()
