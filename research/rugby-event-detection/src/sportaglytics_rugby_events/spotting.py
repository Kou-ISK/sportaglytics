from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

import numpy as np

from .metrics import Prediction
from .models import LABEL_TO_ID, ModelBundle
from .schema import EVENT_TYPES, MatchManifest, TimelineSegment
from .video import iter_uniform_rgb_windows


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


def _progress(message: str) -> None:
    print(f"[rugby-events] {message}", flush=True)


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


def _segment_key(window: ScanWindow) -> tuple[str, Path, float, float]:
    return (
        window.match_id,
        window.segment.video_path,
        window.segment.timeline_start_seconds,
        window.segment.duration_seconds,
    )


def _append_predictions(
    raw_predictions: list[Prediction],
    bundle: ModelBundle,
    windows: list[ScanWindow],
    clips: list[np.ndarray],
) -> None:
    probabilities = bundle.probabilities(clips).detach().cpu()
    for row, window in enumerate(windows):
        for event_type in EVENT_TYPES:
            raw_predictions.append(
                Prediction(
                    match_id=window.match_id,
                    event_type=event_type,
                    anchor_time_seconds=window.global_center_seconds,
                    confidence=float(probabilities[row, LABEL_TO_ID[event_type]].item()),
                )
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
    total_batches = (len(windows) + batch_size - 1) // batch_size
    report_every = max(1, total_batches // 20) if total_batches else 1
    _progress(
        f"whole-match scan start: matches={len(matches)}, windows={len(windows)}, "
        f"stride={stride_seconds:.2f}s, batches={total_batches}, device={bundle.device}"
    )
    start_time = time.perf_counter()

    groups: list[list[ScanWindow]] = []
    current_group: list[ScanWindow] = []
    current_key: tuple[str, Path, float, float] | None = None
    for window in windows:
        key = _segment_key(window)
        if current_key is not None and key != current_key:
            groups.append(current_group)
            current_group = []
        current_group.append(window)
        current_key = key
    if current_group:
        groups.append(current_group)

    batch_windows: list[ScanWindow] = []
    batch_clips: list[np.ndarray] = []
    completed_batches = 0
    processed_windows = 0

    for group_index, group in enumerate(groups, start=1):
        first = group[0]
        _progress(
            f"decoding segment {group_index}/{len(groups)} once: "
            f"{first.segment.video_path.name}, windows={len(group)}"
        )
        ranges = [
            (window.local_start_seconds, window.local_end_seconds)
            for window in group
        ]
        decoded = iter_uniform_rgb_windows(
            first.segment.video_path,
            ranges,
            bundle.candidate.num_frames,
        )
        for window, clip in zip(group, decoded, strict=True):
            batch_windows.append(window)
            batch_clips.append(clip)
            if len(batch_windows) < batch_size:
                continue
            _append_predictions(raw_predictions, bundle, batch_windows, batch_clips)
            processed_windows += len(batch_windows)
            completed_batches += 1
            batch_windows = []
            batch_clips = []
            if (
                completed_batches == 1
                or completed_batches == total_batches
                or completed_batches % report_every == 0
            ):
                elapsed = time.perf_counter() - start_time
                percent = 100.0 * processed_windows / max(1, len(windows))
                _progress(
                    f"whole-match scan {processed_windows}/{len(windows)} windows "
                    f"({percent:.0f}%), elapsed={elapsed:.1f}s"
                )

    if batch_windows:
        _append_predictions(raw_predictions, bundle, batch_windows, batch_clips)
        processed_windows += len(batch_windows)
        completed_batches += 1
        elapsed = time.perf_counter() - start_time
        _progress(
            f"whole-match scan {processed_windows}/{len(windows)} windows "
            f"(100%), elapsed={elapsed:.1f}s"
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
    _progress(
        f"whole-match scan complete: windows={len(windows)}, "
        f"elapsed={wall_seconds:.1f}s, candidatesAfterNms={len(predictions)}"
    )
    return ScanSummary(
        predictions=predictions,
        window_count=len(windows),
        video_seconds=video_seconds,
        wall_seconds=wall_seconds,
    )
