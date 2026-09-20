import { resolveTimelineClip } from '../../types/package/clipTimeline';

export interface MediaTimelineClip {
  id: string;
  source: string;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

/** Placements use the angle clock; presentation uses the shared package clock. */
export interface MediaTimeline {
  clips: MediaTimelineClip[];
  offsetSeconds: number;
}

export const getAngleOffset = (
  sync:
    | { syncOffset: number; angleOffsets?: number[]; isAnalyzed: boolean }
    | undefined,
  index: number,
): number =>
  index === 0 || !sync?.isAnalyzed
    ? 0
    : (sync.angleOffsets?.[index] ?? sync.syncOffset);

export const resolveMediaTime = (
  timeline: MediaTimeline,
  globalTime: number,
): {
  clip: MediaTimelineClip;
  sourceTime: number;
  globalEnd: number;
  sourceTimeOffset: number;
} | null => {
  const active = resolveTimelineClip(
    timeline.clips,
    globalTime + timeline.offsetSeconds,
  );
  if (!active) return null;
  const sourceTimeOffset =
    timeline.offsetSeconds - active.clip.timelineStartSeconds;
  return {
    clip: active.clip,
    sourceTime: active.clipTimeSeconds,
    sourceTimeOffset,
    globalEnd: (active.clip.durationSeconds ?? Infinity) - sourceTimeOffset,
  };
};

export const getMediaTimelineEnd = (timeline: MediaTimeline): number =>
  Math.max(
    0,
    ...timeline.clips.map(
      (clip) =>
        clip.timelineStartSeconds +
        (clip.durationSeconds ?? 0) -
        timeline.offsetSeconds,
    ),
  );

export const singleSourceTimeline = (source: string): MediaTimeline => ({
  offsetSeconds: 0,
  clips: [{ id: source, source, timelineStartSeconds: 0 }],
});
