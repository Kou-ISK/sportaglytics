from __future__ import annotations

from dataclasses import dataclass
import random

import numpy as np

from .models import LABEL_TO_ID
from .schema import DatasetManifest, MatchManifest, TimelineSegment
from .video import read_uniform_rgb_frames


@dataclass(frozen=True)
class ClipSample:
    match_id: str
    event_type: str
    label_id: int
    segment: TimelineSegment
    local_start_seconds: float
    local_end_seconds: float
    global_center_seconds: float


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


def build_positive_samples(
    matches: tuple[MatchManifest, ...],
    clip_duration_seconds: float,
) -> list[ClipSample]:
    samples: list[ClipSample] = []
    for match in matches:
        for event in match.events:
            segment = _segment_for_time(match, event.anchor_time_seconds)
            if segment is None:
                continue
            window = _window_in_segment(
                segment,
                event.anchor_time_seconds,
                clip_duration_seconds,
            )
            if window is None:
                continue
            local_start, local_end = window
            samples.append(
                ClipSample(
                    match_id=match.match_id,
                    event_type=event.event_type,
                    label_id=LABEL_TO_ID[event.event_type],
                    segment=segment,
                    local_start_seconds=local_start,
                    local_end_seconds=local_end,
                    global_center_seconds=event.anchor_time_seconds,
                )
            )
    return samples


def _negative_candidates(
    matches: tuple[MatchManifest, ...],
    clip_duration_seconds: float,
    exclusion_seconds: float,
) -> list[ClipSample]:
    samples: list[ClipSample] = []
    stride = max(clip_duration_seconds, 1.0)
    for match in matches:
        event_times = [event.anchor_time_seconds for event in match.events]
        for segment in match.segments:
            if segment.duration_seconds < clip_duration_seconds:
                continue
            half = clip_duration_seconds / 2
            first_center = segment.timeline_start_seconds + half
            last_center = segment.timeline_end_seconds - half
            center = first_center
            while center <= last_center + 1e-6:
                if all(abs(center - event_time) >= exclusion_seconds for event_time in event_times):
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
) -> list[ClipSample]:
    matches = tuple(match for match in manifest.matches if match.split == split)
    positive = build_positive_samples(matches, clip_duration_seconds)
    negative = _negative_candidates(
        matches,
        clip_duration_seconds,
        exclusion_seconds=max(clip_duration_seconds, 5.0),
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
    return [
        read_uniform_rgb_frames(
            sample.segment.video_path,
            sample.local_start_seconds,
            sample.local_end_seconds,
            num_frames,
        )
        for sample in samples
    ]
