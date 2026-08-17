from __future__ import annotations

import sys
from pathlib import Path
import unittest

RESEARCH_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from sportaglytics_rugby_events.metrics import (  # noqa: E402
    Prediction,
    evaluate_event,
    select_research_thresholds,
    select_thresholds,
    summarize_research_event,
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
            EventAnnotation(event_type="restart", anchor_time_seconds=event_time + 5),
            EventAnnotation(event_type="scrum", anchor_time_seconds=event_time + 10),
            EventAnnotation(event_type="lineout", anchor_time_seconds=event_time + 20),
        ),
    )


class MetricsTest(unittest.TestCase):
    def test_quality_gate_matches_existing_product_policy(self) -> None:
        matches = tuple(make_match(f"test-{index}", "test", 10.0) for index in range(5))
        predictions = [
            Prediction(match.match_id, "scrum", 21.0, 0.9)
            for match in matches
        ]
        metrics = evaluate_event(matches, predictions, "scrum", 0.8)
        self.assertEqual(metrics.true_positive, 5)
        self.assertEqual(metrics.false_positive, 0)
        self.assertEqual(metrics.false_negative, 0)
        self.assertAlmostEqual(metrics.timestamp_within_two_seconds_rate, 1.0)
        self.assertTrue(metrics.passes_gate)

    def test_prediction_inside_coded_interval_has_zero_timing_error(self) -> None:
        match = MatchManifest(
            match_id="validation-interval",
            split="validation",
            segments=(
                TimelineSegment(
                    video_path=Path("/tmp/validation-interval.mp4"),
                    timeline_start_seconds=0,
                    duration_seconds=100,
                ),
            ),
            events=(
                EventAnnotation(
                    event_type="scrum",
                    anchor_time_seconds=20.0,
                    end_time_seconds=30.0,
                ),
            ),
        )
        predictions = [Prediction(match.match_id, "scrum", 27.0, 0.9)]

        metrics = evaluate_event((match,), predictions, "scrum", 0.8)

        self.assertEqual(metrics.true_positive, 1)
        self.assertEqual(metrics.false_positive, 0)
        self.assertAlmostEqual(metrics.mean_absolute_error_seconds or 0.0, 0.0)
        self.assertAlmostEqual(metrics.within_annotated_interval_rate, 1.0)
        self.assertAlmostEqual(metrics.timestamp_within_two_seconds_rate, 1.0)

    def test_gate_requires_five_unseen_matches(self) -> None:
        matches = tuple(make_match(f"test-{index}", "test", 10.0) for index in range(4))
        predictions = [
            Prediction(match.match_id, "scrum", 20.0, 0.99)
            for match in matches
        ]
        metrics = evaluate_event(matches, predictions, "scrum", 0.9)
        self.assertFalse(metrics.passes_gate)

    def test_validation_threshold_rejects_lower_confidence_false_positives(self) -> None:
        matches = tuple(
            make_match(f"validation-{index}", "validation", 10.0)
            for index in range(5)
        )
        predictions: list[Prediction] = []
        for match in matches:
            for event_type, event_time in (
                ("restart", 15.0),
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
        self.assertGreater(thresholds["restart"], 0.60)
        self.assertGreater(thresholds["scrum"], 0.60)
        self.assertGreater(thresholds["lineout"], 0.60)
        self.assertLessEqual(thresholds["restart"], 0.90)
        self.assertLessEqual(thresholds["scrum"], 0.90)

    def test_research_threshold_is_selected_by_best_f1(self) -> None:
        matches = tuple(
            make_match(f"validation-{index}", "validation", 10.0)
            for index in range(5)
        )
        predictions: list[Prediction] = []
        for match in matches:
            predictions.append(Prediction(match.match_id, "scrum", 20.5, 0.70))
        predictions.extend(
            Prediction(matches[index].match_id, "scrum", 70.0, 0.65)
            for index in range(2)
        )

        product_thresholds = select_thresholds(matches, predictions)
        research_thresholds = select_research_thresholds(matches, predictions)
        summary = summarize_research_event(matches, predictions, "scrum")

        self.assertGreaterEqual(product_thresholds["scrum"], research_thresholds["scrum"])
        self.assertAlmostEqual(summary.best_f1, 1.0)
        self.assertAlmostEqual(summary.precision_at_best_f1, 1.0)
        self.assertAlmostEqual(summary.recall_at_best_f1, 1.0)


if __name__ == "__main__":
    unittest.main()
