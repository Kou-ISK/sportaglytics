from __future__ import annotations

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
