from __future__ import annotations

from dataclasses import dataclass
import random
from typing import TYPE_CHECKING

from .schema import EVENT_TYPES, DatasetManifest, EventAnnotation, MatchManifest, TimelineSegment

if TYPE_CHECKING:
    import numpy as np

LABEL_TO_ID = {
    label: index
    for index, label in enumerate((*EVENT_TYPES, "other"))
}

# Existing coding ranges are intentionally weak supervision: users code a useful
# review interval, not a frame-exact action boundary. Sample the early part of that
# interval so long Restart sequences do not teach ordinary open play as Restart.
DEFAULT_POSITIVE_SAMPLES_PER_EVENT = 2
DEFAULT_POSITIVE_SPAN_SECONDS = 8.0


@dataclass(frozen=True)
class ClipSample:
    match_id: str
    event_type: str
    label_id: int
    segment: TimelineSegment
    local_start_seconds: float
    local_end_seconds: float
    global_center_seconds: float


def clip_sample_key(sample: ClipSample) -> tuple[str, str, float, float]:
    return (
        sample.match_id,
        str(sample.segment.video_path),
        round(sample.local_start_seconds, 6),
        round(sample.local_end_seconds, 6),
    )


def _window_in_segment(
    segment: TimelineSegment,
    center_seconds: float,
    duration_seconds: float,
) -> tuple[float, float] | None:
    if duration_seconds <= 0 or segment.duration_seconds < duration_seconds:
        return None
    half = duration_seconds / 2
    global_start = center_seconds - half
    minimum_start = segment.timeline_start_seconds
    maximum_start = segment.timeline_end_seconds - duration_seconds
    global_start = min(max(global_start, minimum_start), maximum_start)
    global_end = global_start + duration_seconds
    local_start = global_start - segment.timeline_start_seconds
    return local_start, local_start + duration_seconds


def _segment_for_time(
    match: MatchManifest,
    timestamp_seconds: float,
) -> TimelineSegment | None:
    return next(
        (
            segment
            for segment in match.segments
            if segment.timeline_start_seconds - 1e-6
            <= timestamp_seconds
            <= segment.timeline_end_seconds + 1e-6
        ),
        None,
    )


def _positive_centers(
    event: EventAnnotation,
    samples_per_event: int,
    positive_span_seconds: float,
) -> tuple[float, ...]:
    if samples_per_event <= 0:
        raise ValueError("samples_per_event must be positive")
    if positive_span_seconds <= 0:
        raise ValueError("positive_span_seconds must be positive")

    supervision_end = min(
        event.interval_end_seconds,
        event.anchor_time_seconds + positive_span_seconds,
    )
    span = max(0.0, supervision_end - event.anchor_time_seconds)
    if span <= 1e-6:
        return (event.anchor_time_seconds,)

    # Exclude the terminal endpoint. For a long coded sequence, the very end can
    # already look like ordinary play rather than the set-piece/restart we want to spot.
    step = span / samples_per_event
    return tuple(
        event.anchor_time_seconds + step * index
        for index in range(samples_per_event)
    )


def build_positive_samples(
    matches: tuple[MatchManifest, ...],
    clip_duration_seconds: float,
    samples_per_event: int = DEFAULT_POSITIVE_SAMPLES_PER_EVENT,
    positive_span_seconds: float = DEFAULT_POSITIVE_SPAN_SECONDS,
) -> list[ClipSample]:
    samples: list[ClipSample] = []
    for match in matches:
        for event in match.events:
            seen_windows: set[tuple[str, str, float, float]] = set()
            for center_seconds in _positive_centers(
                event,
                samples_per_event,
                positive_span_seconds,
            ):
                segment = _segment_for_time(match, center_seconds)
                if segment is None:
                    continue
                window = _window_in_segment(
                    segment,
                    center_seconds,
                    clip_duration_seconds,
                )
                if window is None:
                    continue
                local_start, local_end = window
                sample = ClipSample(
                    match_id=match.match_id,
                    event_type=event.event_type,
                    label_id=LABEL_TO_ID[event.event_type],
                    segment=segment,
                    local_start_seconds=local_start,
                    local_end_seconds=local_end,
                    global_center_seconds=center_seconds,
                )
                window_key = clip_sample_key(sample)
                if window_key in seen_windows:
                    continue
                seen_windows.add(window_key)
                samples.append(sample)
    return samples


def _distance_to_event_interval(center_seconds: float, event: EventAnnotation) -> float:
    if center_seconds < event.anchor_time_seconds:
        return event.anchor_time_seconds - center_seconds
    if center_seconds > event.interval_end_seconds:
        return center_seconds - event.interval_end_seconds
    return 0.0


def build_negative_candidate_pool(
    manifest: DatasetManifest,
    split: str,
    clip_duration_seconds: float,
    exclusion_seconds: float | None = None,
) -> list[ClipSample]:
    """Build deterministic background windows that are safe to label as ``other``.

    Every candidate is kept away from the full annotated interval of every target
    event. The pool is intentionally larger than the random-negative subset used by
    the first training stage so a trained model can later mine the most confusing
    background examples without touching Validation or Test.
    """

    matches = tuple(match for match in manifest.matches if match.split == split)
    exclusion = (
        max(clip_duration_seconds, 5.0)
        if exclusion_seconds is None
        else max(0.0, exclusion_seconds)
    )
    samples: list[ClipSample] = []
    stride = max(clip_duration_seconds, 1.0)
    for match in matches:
        for segment in match.segments:
            if segment.duration_seconds < clip_duration_seconds:
                continue
            half = clip_duration_seconds / 2
            first_center = segment.timeline_start_seconds + half
            last_center = segment.timeline_end_seconds - half
            center = first_center
            while center <= last_center + 1e-6:
                if all(
                    _distance_to_event_interval(center, event) >= exclusion
                    for event in match.events
                ):
                    local_start = center - half - segment.timeline_start_seconds
                    samples.append(
                        ClipSample(
                            match_id=match.match_id,
                            event_type="other",
                            label_id=LABEL_TO_ID["other"],
                            segment=segment,
                            local_start_seconds=local_start,
                            local_end_seconds=local_start + clip_duration_seconds,
                            global_center_seconds=center,
                        )
                    )
                center += stride
    return samples


def build_training_samples(
    manifest: DatasetManifest,
    split: str,
    clip_duration_seconds: float,
    negative_ratio: float,
    seed: int,
    positive_samples_per_event: int = DEFAULT_POSITIVE_SAMPLES_PER_EVENT,
    positive_span_seconds: float = DEFAULT_POSITIVE_SPAN_SECONDS,
) -> list[ClipSample]:
    matches = tuple(match for match in manifest.matches if match.split == split)
    positive = build_positive_samples(
        matches,
        clip_duration_seconds,
        samples_per_event=positive_samples_per_event,
        positive_span_seconds=positive_span_seconds,
    )
    negative = build_negative_candidate_pool(
        manifest,
        split,
        clip_duration_seconds,
    )
    target_negative = int(round(len(positive) * max(0.0, negative_ratio)))
    if positive and target_negative == 0 and negative:
        target_negative = 1
    if target_negative < len(negative):
        rng = random.Random(seed)
        negative = rng.sample(negative, target_negative)
    samples = [*positive, *negative]
    rng = random.Random(seed)
    rng.shuffle(samples)
    return samples


def decode_samples(
    samples: list[ClipSample],
    num_frames: int,
) -> list[np.ndarray]:
    # Keep discovery/sampling importable in the lightweight CI environment.
    # Video/ML dependencies are required only when clips are actually decoded.
    from .video import read_uniform_rgb_frames

    return [
        read_uniform_rgb_frames(
            sample.segment.video_path,
            sample.local_start_seconds,
            sample.local_end_seconds,
            num_frames,
        )
        for sample in samples
    ]