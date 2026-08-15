from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.metrics import (  # noqa: E402
    Prediction,
    evaluate_event,
    select_thresholds,
)
from sportaglytics_rugby_events.schema import (  # noqa: E402
    EventAnnotation,
    MatchManifest,
    TimelineSegment,
)


def make_match(match_id: str, split: str, event_time: float) -> MatchManifest:
    return MatchManifest(
        match_id=match_id,
        split=split,
        segments=(
            TimelineSegment(
                video_path=Path(f"/tmp/{match_id}.mp4"),
                timeline_start_seconds=0,
                duration_seconds=100,
            ),
        ),
        events=(
            EventAnnotation(event_type="kickoff", anchor_time_seconds=event_time),
            EventAnnotation(event_type="scrum", anchor_time_seconds=event_time + 10),
            EventAnnotation(event_type="lineout", anchor_time_seconds=event_time + 20),
        ),
    )


class MetricsTest(unittest.TestCase):
    def test_quality_gate_matches_existing_product_policy(self) -> None:
        matches = tuple(make_match(f"test-{index}", "test", 10.0) for index in range(5))
        predictions = [
            Prediction(match.match_id, "kickoff", 11.0, 0.9)
            for match in matches
        ]
        metrics = evaluate_event(matches, predictions, "kickoff", 0.8)
        self.assertEqual(metrics.true_positive, 5)
        self.assertEqual(metrics.false_positive, 0)
        self.assertEqual(metrics.false_negative, 0)
        self.assertAlmostEqual(metrics.timestamp_within_two_seconds_rate, 1.0)
        self.assertTrue(metrics.passes_gate)

    def test_gate_requires_five_unseen_matches(self) -> None:
        matches = tuple(make_match(f"test-{index}", "test", 10.0) for index in range(4))
        predictions = [
            Prediction(match.match_id, "kickoff", 10.0, 0.99)
            for match in matches
        ]
        metrics = evaluate_event(matches, predictions, "kickoff", 0.9)
        self.assertFalse(metrics.passes_gate)

    def test_validation_threshold_rejects_lower_confidence_false_positives(self) -> None:
        matches = tuple(
            make_match(f"validation-{index}", "validation", 10.0)
            for index in range(5)
        )
        predictions: list[Prediction] = []
        for match in matches:
            for event_type, event_time in (
                ("kickoff", 10.0),
                ("scrum", 20.0),
                ("lineout", 30.0),
            ):
                predictions.append(
                    Prediction(match.match_id, event_type, event_time + 0.5, 0.90)
                )
                predictions.append(
                    Prediction(match.match_id, event_type, event_time + 40.0, 0.60)
                )

        thresholds = select_thresholds(matches, predictions)
        self.assertGreater(thresholds["kickoff"], 0.60)
        self.assertGreater(thresholds["scrum"], 0.60)
        self.assertGreater(thresholds["lineout"], 0.60)
        self.assertLessEqual(thresholds["kickoff"], 0.90)


if __name__ == "__main__":
    unittest.main()
