from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable

from .schema import EVENT_TYPES, MatchManifest

MATCH_TOLERANCE_SECONDS = 5.0
PRECISE_TOLERANCE_SECONDS = 2.0
MIN_PRECISION = 0.95
MIN_RECALL = 0.90
MIN_EVALUATED_MATCHES = 5
MIN_PRECISE_RATE = 0.90


@dataclass(frozen=True)
class Prediction:
    match_id: str
    event_type: str
    anchor_time_seconds: float
    confidence: float


@dataclass(frozen=True)
class EventMetrics:
    event_type: str
    confidence_threshold: float
    precision: float
    recall: float
    f1: float
    evaluated_matches: int
    timestamp_within_two_seconds_rate: float
    mean_absolute_error_seconds: float | None
    true_positive: int
    false_positive: int
    false_negative: int
    passes_gate: bool

    def to_json(self) -> dict[str, object]:
        return asdict(self)


def _predictions_for(
    predictions: Iterable[Prediction],
    match_id: str,
    event_type: str,
    threshold: float,
) -> list[Prediction]:
    return sorted(
        (
            item
            for item in predictions
            if item.match_id == match_id
            and item.event_type == event_type
            and item.confidence >= threshold
        ),
        key=lambda item: item.confidence,
        reverse=True,
    )


def evaluate_event(
    matches: tuple[MatchManifest, ...],
    predictions: list[Prediction],
    event_type: str,
    threshold: float,
) -> EventMetrics:
    true_positive = 0
    false_positive = 0
    false_negative = 0
    within_two_seconds = 0
    absolute_errors: list[float] = []
    known_match_ids = {match.match_id for match in matches}

    for match in matches:
        truths = [
            event.anchor_time_seconds
            for event in match.events
            if event.event_type == event_type
        ]
        unmatched_truth = list(truths)
        match_predictions = _predictions_for(
            predictions,
            match.match_id,
            event_type,
            threshold,
        )
        for prediction in match_predictions:
            if not unmatched_truth:
                false_positive += 1
                continue
            distances = [
                abs(prediction.anchor_time_seconds - truth_time)
                for truth_time in unmatched_truth
            ]
            nearest_index = min(range(len(distances)), key=distances.__getitem__)
            nearest_distance = distances[nearest_index]
            if nearest_distance <= MATCH_TOLERANCE_SECONDS:
                true_positive += 1
                absolute_errors.append(nearest_distance)
                if nearest_distance <= PRECISE_TOLERANCE_SECONDS:
                    within_two_seconds += 1
                unmatched_truth.pop(nearest_index)
            else:
                false_positive += 1
        false_negative += len(unmatched_truth)

    false_positive += sum(
        1
        for prediction in predictions
        if prediction.match_id not in known_match_ids
        and prediction.event_type == event_type
        and prediction.confidence >= threshold
    )

    precision_denominator = true_positive + false_positive
    recall_denominator = true_positive + false_negative
    precision = true_positive / precision_denominator if precision_denominator else 0.0
    recall = true_positive / recall_denominator if recall_denominator else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall > 0
        else 0.0
    )
    precise_rate = within_two_seconds / true_positive if true_positive else 0.0
    mean_error = (
        sum(absolute_errors) / len(absolute_errors)
        if absolute_errors
        else None
    )
    passes_gate = (
        precision >= MIN_PRECISION
        and recall >= MIN_RECALL
        and len(matches) >= MIN_EVALUATED_MATCHES
        and precise_rate >= MIN_PRECISE_RATE
    )
    return EventMetrics(
        event_type=event_type,
        confidence_threshold=threshold,
        precision=precision,
        recall=recall,
        f1=f1,
        evaluated_matches=len(matches),
        timestamp_within_two_seconds_rate=precise_rate,
        mean_absolute_error_seconds=mean_error,
        true_positive=true_positive,
        false_positive=false_positive,
        false_negative=false_negative,
        passes_gate=passes_gate,
    )


def threshold_grid() -> tuple[float, ...]:
    return tuple(round(value / 100, 2) for value in range(50, 100))


def select_thresholds(
    validation_matches: tuple[MatchManifest, ...],
    predictions: list[Prediction],
) -> dict[str, float]:
    selected: dict[str, float] = {}
    for event_type in EVENT_TYPES:
        evaluated = [
            evaluate_event(
                validation_matches,
                predictions,
                event_type,
                threshold,
            )
            for threshold in threshold_grid()
        ]
        precision_qualified = [
            item for item in evaluated if item.precision >= MIN_PRECISION
        ]
        pool = precision_qualified if precision_qualified else evaluated
        best = max(
            pool,
            key=lambda item: (
                item.recall,
                item.timestamp_within_two_seconds_rate,
                item.precision,
                item.f1,
                item.confidence_threshold,
            )
            if precision_qualified
            else (
                item.precision,
                item.recall,
                item.timestamp_within_two_seconds_rate,
                item.f1,
                item.confidence_threshold,
            ),
        )
        selected[event_type] = best.confidence_threshold
    return selected


def evaluate_all(
    matches: tuple[MatchManifest, ...],
    predictions: list[Prediction],
    thresholds: dict[str, float],
) -> dict[str, EventMetrics]:
    return {
        event_type: evaluate_event(
            matches,
            predictions,
            event_type,
            thresholds[event_type],
        )
        for event_type in EVENT_TYPES
    }
