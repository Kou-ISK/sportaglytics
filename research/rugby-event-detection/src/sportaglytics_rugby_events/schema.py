from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

EVENT_TYPES = ("kickoff", "scrum", "lineout")
Split = Literal["train", "validation", "test"]


def _require_mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def _require_float(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be numeric")
    result = float(value)
    if result < 0:
        raise ValueError(f"{label} must be >= 0")
    return result


def _optional_positive_int(value: Any, label: str) -> int | None:
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{label} must be a positive integer when provided")
    return value


@dataclass(frozen=True)
class TimelineSegment:
    video_path: Path
    timeline_start_seconds: float
    duration_seconds: float

    @property
    def timeline_end_seconds(self) -> float:
        return self.timeline_start_seconds + self.duration_seconds

    @classmethod
    def from_json(cls, value: Any) -> "TimelineSegment":
        data = _require_mapping(value, "segment")
        path_value = Path(_require_string(data.get("videoPath"), "segment.videoPath"))
        duration = _require_float(data.get("durationSeconds"), "segment.durationSeconds")
        if duration <= 0:
            raise ValueError("segment.durationSeconds must be > 0")
        return cls(
            video_path=path_value,
            timeline_start_seconds=_require_float(
                data.get("timelineStartSeconds", 0),
                "segment.timelineStartSeconds",
            ),
            duration_seconds=duration,
        )


@dataclass(frozen=True)
class EventAnnotation:
    event_type: str
    anchor_time_seconds: float

    @classmethod
    def from_json(cls, value: Any) -> "EventAnnotation":
        data = _require_mapping(value, "event")
        event_type = _require_string(data.get("eventType"), "event.eventType")
        if event_type not in EVENT_TYPES:
            raise ValueError(f"unsupported event type: {event_type}")
        return cls(
            event_type=event_type,
            anchor_time_seconds=_require_float(
                data.get("anchorTimeSeconds"),
                "event.anchorTimeSeconds",
            ),
        )


@dataclass(frozen=True)
class MatchManifest:
    match_id: str
    split: Split
    segments: tuple[TimelineSegment, ...]
    events: tuple[EventAnnotation, ...]

    @classmethod
    def from_json(cls, value: Any) -> "MatchManifest":
        data = _require_mapping(value, "match")
        split_value = _require_string(data.get("split"), "match.split")
        if split_value not in ("train", "validation", "test"):
            raise ValueError(f"unsupported split: {split_value}")
        split = cast(Split, split_value)
        raw_segments = data.get("segments")
        raw_events = data.get("events", [])
        if not isinstance(raw_segments, list) or not raw_segments:
            raise ValueError("match.segments must be a non-empty array")
        if not isinstance(raw_events, list):
            raise ValueError("match.events must be an array")
        segments = tuple(TimelineSegment.from_json(item) for item in raw_segments)
        events = tuple(EventAnnotation.from_json(item) for item in raw_events)
        return cls(
            match_id=_require_string(data.get("matchId"), "match.matchId"),
            split=split,
            segments=segments,
            events=events,
        )


@dataclass(frozen=True)
class DatasetManifest:
    dataset_id: str
    matches: tuple[MatchManifest, ...]

    @classmethod
    def from_json(cls, value: Any) -> "DatasetManifest":
        data = _require_mapping(value, "manifest")
        if data.get("version") != 1:
            raise ValueError("manifest.version must be 1")
        raw_matches = data.get("matches")
        if not isinstance(raw_matches, list) or not raw_matches:
            raise ValueError("manifest.matches must be a non-empty array")
        matches = tuple(MatchManifest.from_json(item) for item in raw_matches)
        ids = [match.match_id for match in matches]
        if len(ids) != len(set(ids)):
            raise ValueError("matchId values must be unique")
        for required_split in ("train", "validation", "test"):
            if not any(match.split == required_split for match in matches):
                raise ValueError(f"manifest must contain a {required_split} split")
        return cls(
            dataset_id=_require_string(data.get("datasetId"), "manifest.datasetId"),
            matches=matches,
        )


@dataclass(frozen=True)
class ModelCandidate:
    model_id: str
    family: str
    checkpoint: str
    license_name: str
    production_eligible: bool
    num_frames: int
    clip_duration_seconds: float
    sampling_rate: int | None = None
    assumed_fps: int | None = None
    side_size: int | None = None
    crop_size: int | None = None
    slowfast_alpha: int | None = None
    source_revision: str | None = None

    @classmethod
    def from_json(cls, value: Any) -> "ModelCandidate":
        data = _require_mapping(value, "model")
        num_frames = data.get("numFrames")
        if not isinstance(num_frames, int) or isinstance(num_frames, bool) or num_frames <= 0:
            raise ValueError("model.numFrames must be a positive integer")
        production_eligible = data.get("productionEligible")
        if not isinstance(production_eligible, bool):
            raise ValueError("model.productionEligible must be boolean")
        clip_duration = _require_float(
            data.get("clipDurationSeconds"),
            "model.clipDurationSeconds",
        )
        if clip_duration <= 0:
            raise ValueError("model.clipDurationSeconds must be > 0")
        return cls(
            model_id=_require_string(data.get("id"), "model.id"),
            family=_require_string(data.get("family"), "model.family"),
            checkpoint=_require_string(data.get("checkpoint"), "model.checkpoint"),
            license_name=_require_string(data.get("license"), "model.license"),
            production_eligible=production_eligible,
            num_frames=num_frames,
            clip_duration_seconds=clip_duration,
            sampling_rate=_optional_positive_int(data.get("samplingRate"), "model.samplingRate"),
            assumed_fps=_optional_positive_int(data.get("assumedFps"), "model.assumedFps"),
            side_size=_optional_positive_int(data.get("sideSize"), "model.sideSize"),
            crop_size=_optional_positive_int(data.get("cropSize"), "model.cropSize"),
            slowfast_alpha=_optional_positive_int(data.get("slowfastAlpha"), "model.slowfastAlpha"),
            source_revision=data.get("sourceRevision")
            if isinstance(data.get("sourceRevision"), str)
            else None,
        )
