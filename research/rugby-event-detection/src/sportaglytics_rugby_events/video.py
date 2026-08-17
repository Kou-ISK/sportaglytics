from __future__ import annotations

from collections.abc import Iterator, Sequence
from pathlib import Path

import av
import numpy as np
import torch
import torch.nn.functional as F


KINETICS_MEAN = torch.tensor([0.45, 0.45, 0.45], dtype=torch.float32)
KINETICS_STD = torch.tensor([0.225, 0.225, 0.225], dtype=torch.float32)


def probe_video_duration(path: Path) -> float:
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        if stream.duration is not None and stream.time_base is not None:
            duration = float(stream.duration * stream.time_base)
        elif container.duration is not None:
            duration = float(container.duration / av.time_base)
        else:
            raise ValueError(f"unable to determine video duration: {path}")
    if duration <= 0:
        raise ValueError(f"invalid video duration: {path}")
    return duration


def _frame_timestamp_seconds(frame: av.VideoFrame, stream: av.VideoStream) -> float | None:
    if frame.pts is None or stream.time_base is None:
        return None
    return float(frame.pts * stream.time_base)


def read_uniform_rgb_frames(
    path: Path,
    start_seconds: float,
    end_seconds: float,
    num_frames: int,
) -> np.ndarray:
    if num_frames <= 0:
        raise ValueError("num_frames must be positive")
    if end_seconds <= start_seconds:
        raise ValueError("end_seconds must be after start_seconds")

    frames: list[np.ndarray] = []
    timestamps: list[float] = []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        if stream.time_base is not None:
            seek_offset = int(max(0.0, start_seconds - 1.0) / float(stream.time_base))
            container.seek(seek_offset, stream=stream, any_frame=False, backward=True)

        for frame in container.decode(stream):
            timestamp = _frame_timestamp_seconds(frame, stream)
            if timestamp is None:
                continue
            if timestamp + 1e-6 < start_seconds:
                continue
            if timestamp > end_seconds + 1e-6:
                break
            frames.append(frame.to_ndarray(format="rgb24"))
            timestamps.append(timestamp)

    if not frames:
        raise ValueError(
            f"no video frames decoded for {path} at {start_seconds:.3f}-{end_seconds:.3f}s"
        )

    targets = np.linspace(start_seconds, end_seconds, num_frames, dtype=np.float64)
    source_times = np.asarray(timestamps, dtype=np.float64)
    indices = np.abs(source_times[:, None] - targets[None, :]).argmin(axis=0)
    return np.stack([frames[int(index)] for index in indices], axis=0)


def iter_uniform_rgb_windows(
    path: Path,
    windows: Sequence[tuple[float, float]],
    num_frames: int,
) -> Iterator[np.ndarray]:
    """Decode many chronological windows with one sequential pass through a video.

    Whole-match spotting previously reopened and sought the same video once per window.
    This iterator flattens each window's target timestamps, decodes the source once, and
    yields completed windows in input order. Only target frames for the small number of
    overlapping windows are retained, so memory use stays bounded by window overlap rather
    than match duration.
    """

    if num_frames <= 0:
        raise ValueError("num_frames must be positive")
    if not windows:
        return

    normalized: list[tuple[float, float]] = []
    previous_start = -1.0
    for start_seconds, end_seconds in windows:
        if start_seconds < 0:
            raise ValueError("window start must be >= 0")
        if end_seconds <= start_seconds:
            raise ValueError("window end must be after start")
        if start_seconds + 1e-9 < previous_start:
            raise ValueError("windows must be ordered by start time")
        normalized.append((start_seconds, end_seconds))
        previous_start = start_seconds

    targets: list[tuple[float, int, int]] = []
    slots: list[list[np.ndarray | None]] = [
        [None for _ in range(num_frames)] for _ in normalized
    ]
    for window_index, (start_seconds, end_seconds) in enumerate(normalized):
        for sample_index, target in enumerate(
            np.linspace(start_seconds, end_seconds, num_frames, dtype=np.float64)
        ):
            targets.append((float(target), window_index, sample_index))
    targets.sort(key=lambda item: item[0])

    target_index = 0
    next_window_to_yield = 0
    previous_frame: av.VideoFrame | None = None
    previous_timestamp: float | None = None
    previous_rgb: np.ndarray | None = None

    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.thread_type = "AUTO"
        if stream.time_base is not None:
            first_target = targets[0][0]
            seek_offset = int(max(0.0, first_target - 1.0) / float(stream.time_base))
            container.seek(seek_offset, stream=stream, any_frame=False, backward=True)

        for current_frame in container.decode(stream):
            current_timestamp = _frame_timestamp_seconds(current_frame, stream)
            if current_timestamp is None:
                continue
            if current_timestamp + 1e-6 < targets[0][0]:
                previous_frame = current_frame
                previous_timestamp = current_timestamp
                previous_rgb = None
                continue

            current_rgb: np.ndarray | None = None
            while target_index < len(targets) and targets[target_index][0] <= current_timestamp:
                target, window_index, sample_index = targets[target_index]
                choose_previous = (
                    previous_frame is not None
                    and previous_timestamp is not None
                    and abs(previous_timestamp - target) <= abs(current_timestamp - target)
                )
                if choose_previous:
                    if previous_rgb is None:
                        previous_rgb = previous_frame.to_ndarray(format="rgb24")
                    selected = previous_rgb
                else:
                    if current_rgb is None:
                        current_rgb = current_frame.to_ndarray(format="rgb24")
                    selected = current_rgb
                slots[window_index][sample_index] = selected
                target_index += 1

                while next_window_to_yield < len(slots) and all(
                    frame is not None for frame in slots[next_window_to_yield]
                ):
                    completed = slots[next_window_to_yield]
                    yield np.stack(
                        [frame for frame in completed if frame is not None],
                        axis=0,
                    )
                    slots[next_window_to_yield] = []
                    next_window_to_yield += 1

            previous_frame = current_frame
            previous_timestamp = current_timestamp
            previous_rgb = current_rgb
            if target_index >= len(targets):
                break

    if target_index < len(targets):
        if previous_frame is None:
            raise ValueError(f"no video frames decoded for {path}")
        if previous_rgb is None:
            previous_rgb = previous_frame.to_ndarray(format="rgb24")
        while target_index < len(targets):
            _, window_index, sample_index = targets[target_index]
            slots[window_index][sample_index] = previous_rgb
            target_index += 1

    while next_window_to_yield < len(slots):
        completed = slots[next_window_to_yield]
        if len(completed) != num_frames or any(frame is None for frame in completed):
            raise ValueError(
                f"unable to decode all target frames for {path}, window {next_window_to_yield}"
            )
        yield np.stack(
            [frame for frame in completed if frame is not None],
            axis=0,
        )
        next_window_to_yield += 1


def preprocess_kinetics_tensor(
    frames: np.ndarray,
    side_size: int,
    crop_size: int,
) -> torch.Tensor:
    if frames.ndim != 4 or frames.shape[-1] != 3:
        raise ValueError("frames must have shape [T, H, W, 3]")
    tensor = torch.from_numpy(frames).to(dtype=torch.float32) / 255.0
    tensor = tensor.permute(0, 3, 1, 2)

    height, width = tensor.shape[-2:]
    if height <= 0 or width <= 0:
        raise ValueError("invalid frame dimensions")
    scale = side_size / min(height, width)
    resized_height = max(crop_size, int(round(height * scale)))
    resized_width = max(crop_size, int(round(width * scale)))
    tensor = F.interpolate(
        tensor,
        size=(resized_height, resized_width),
        mode="bilinear",
        align_corners=False,
    )

    top = max(0, (resized_height - crop_size) // 2)
    left = max(0, (resized_width - crop_size) // 2)
    tensor = tensor[:, :, top : top + crop_size, left : left + crop_size]
    mean = KINETICS_MEAN.view(1, 3, 1, 1)
    std = KINETICS_STD.view(1, 3, 1, 1)
    tensor = (tensor - mean) / std
    return tensor.permute(1, 0, 2, 3).contiguous()
