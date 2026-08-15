from __future__ import annotations

from dataclasses import dataclass
import time

from .metrics import Prediction
from .models import LABEL_TO_ID, ModelBundle
from .schema import EVENT_TYPES, MatchManifest, TimelineSegment
from .video import read_uniform_rgb_frames


@dataclass(frozen=True)
class ScanWindow:
    match_id: str
    segment: TimelineSegment
    local_start_seconds: float
    local_end_seconds: float
    global_center_seconds: float


@dataclass(frozen=True)
class ScanSummary:
    predictions: list[Prediction]
    window_count: int
    video_seconds: float
    wall_seconds: float

    @property
    def wall_seconds_per_video_minute(self) -> float:
        if self.video_seconds <= 0:
            return 0.0
        return self.wall_seconds / (self.video_seconds / 60.0)


def _scan_windows(
    matches: tuple[MatchManifest, ...],
    clip_duration_seconds: float,
    stride_seconds: float,
) -> list[ScanWindow]:
    if stride_seconds <= 0:
        raise ValueError("stride_seconds must be positive")
    windows: list[ScanWindow] = []
    for match in matches:
        for segment in match.segments:
            maximum_start = segment.duration_seconds - clip_duration_seconds
            if maximum_start < 0:
                continue
            starts: list[float] = []
            start = 0.0
            while start <= maximum_start + 1e-6:
                starts.append(min(start, maximum_start))
                start += stride_seconds
            if not starts or abs(starts[-1] - maximum_start) > 1e-6:
                starts.append(maximum_start)
            for local_start in starts:
                windows.append(
                    ScanWindow(
                        match_id=match.match_id,
                        segment=segment,
                        local_start_seconds=local_start,
                        local_end_seconds=local_start + clip_duration_seconds,
                        global_center_seconds=(
                            segment.timeline_start_seconds
                            + local_start
                            + clip_duration_seconds / 2
                        ),
                    )
                )
    return windows


def _temporal_nms(
    predictions: list[Prediction],
    minimum_separation_seconds: float,
) -> list[Prediction]:
    selected: list[Prediction] = []
    grouped: dict[tuple[str, str], list[Prediction]] = {}
    for prediction in predictions:
        grouped.setdefault(
            (prediction.match_id, prediction.event_type),
            [],
        ).append(prediction)

    for group in grouped.values():
        accepted: list[Prediction] = []
        for candidate in sorted(group, key=lambda item: item.confidence, reverse=True):
            if all(
                abs(candidate.anchor_time_seconds - item.anchor_time_seconds)
                >= minimum_separation_seconds
                for item in accepted
            ):
                accepted.append(candidate)
        selected.extend(accepted)

    return sorted(
        selected,
        key=lambda item: (item.match_id, item.anchor_time_seconds, item.event_type),
    )


def scan_matches(
    bundle: ModelBundle,
    matches: tuple[MatchManifest, ...],
    stride_seconds: float,
    batch_size: int,
    minimum_separation_seconds: float,
) -> ScanSummary:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    windows = _scan_windows(
        matches,
        bundle.candidate.clip_duration_seconds,
        stride_seconds,
    )
    raw_predictions: list[Prediction] = []
    start_time = time.perf_counter()

    for index in range(0, len(windows), batch_size):
        batch = windows[index : index + batch_size]
        clips = [
            read_uniform_rgb_frames(
                window.segment.video_path,
                window.local_start_seconds,
                window.local_end_seconds,
                bundle.candidate.num_frames,
            )
            for window in batch
        ]
        probabilities = bundle.probabilities(clips).detach().cpu()
        for row, window in enumerate(batch):
            for event_type in EVENT_TYPES:
                raw_predictions.append(
                    Prediction(
                        match_id=window.match_id,
                        event_type=event_type,
                        anchor_time_seconds=window.global_center_seconds,
                        confidence=float(
                            probabilities[row, LABEL_TO_ID[event_type]].item()
                        ),
                    )
                )

    wall_seconds = time.perf_counter() - start_time
    predictions = _temporal_nms(
        raw_predictions,
        max(0.1, minimum_separation_seconds),
    )
    video_seconds = sum(
        segment.duration_seconds
        for match in matches
        for segment in match.segments
    )
    return ScanSummary(
        predictions=predictions,
        window_count=len(windows),
        video_seconds=video_seconds,
        wall_seconds=wall_seconds,
    )
