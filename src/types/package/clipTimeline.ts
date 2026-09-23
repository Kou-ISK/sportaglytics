export const MAX_PACKAGE_TIMELINE_SECONDS = 24 * 60 * 60;
const TIMELINE_EPSILON_SECONDS = 0.001;

export interface TimelineClip {
  id: string;
  timelineStartSeconds: number;
  durationSeconds: number;
}

export interface DerivedTimelineClip extends TimelineClip {
  gapBeforeSeconds: number;
}

export interface TimelineOverlap {
  previousClipId: string;
  clipId: string;
  overlapSeconds: number;
}

export const isValidTimelineSecond = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= MAX_PACKAGE_TIMELINE_SECONDS;

export const deriveTimelineGaps = (
  clips: TimelineClip[],
): { clips: DerivedTimelineClip[]; overlap?: TimelineOverlap } => {
  const ordered = [...clips].sort(
    (left, right) =>
      left.timelineStartSeconds - right.timelineStartSeconds ||
      left.id.localeCompare(right.id),
  );
  const derived: DerivedTimelineClip[] = [];

  for (const clip of ordered) {
    if (
      !isValidTimelineSecond(clip.timelineStartSeconds) ||
      !Number.isFinite(clip.durationSeconds) ||
      clip.durationSeconds <= 0
    ) {
      throw new Error('INVALID_CLIP_TIMELINE');
    }
    const previous = derived[derived.length - 1];
    const previousEnd = previous
      ? previous.timelineStartSeconds + previous.durationSeconds
      : 0;
    const gapBeforeSeconds = clip.timelineStartSeconds - previousEnd;
    if (gapBeforeSeconds < -TIMELINE_EPSILON_SECONDS && previous) {
      return {
        clips: derived,
        overlap: {
          previousClipId: previous.id,
          clipId: clip.id,
          overlapSeconds: Math.abs(gapBeforeSeconds),
        },
      };
    }
    derived.push({
      ...clip,
      gapBeforeSeconds: Math.max(0, gapBeforeSeconds),
    });
  }

  return { clips: derived };
};

export const calculateTimelineStart = ({
  referenceStartSeconds,
  referenceCurrentSeconds,
  targetCurrentSeconds,
  referenceOffsetSeconds = 0,
  targetOffsetSeconds = 0,
}: {
  referenceStartSeconds: number;
  referenceCurrentSeconds: number;
  targetCurrentSeconds: number;
  referenceOffsetSeconds?: number;
  targetOffsetSeconds?: number;
}): number =>
  referenceStartSeconds +
  referenceCurrentSeconds -
  referenceOffsetSeconds -
  targetCurrentSeconds +
  targetOffsetSeconds;

export const usesVirtualClipTimeline = (
  clips: Array<{ timelineStartSeconds: number }>,
): boolean =>
  clips.length > 1 ||
  clips.some((clip) => clip.timelineStartSeconds > TIMELINE_EPSILON_SECONDS);

const orderedTimelineClips = new WeakMap<
  object,
  Array<{ timelineStartSeconds: number; durationSeconds?: number }>
>();

export const resolveTimelineClip = <
  TClip extends {
    timelineStartSeconds: number;
    durationSeconds?: number;
  },
>(
  clips: TClip[],
  timelineSeconds: number,
): { clip: TClip; clipTimeSeconds: number } | null => {
  // Inputs are immutable. Cache their order once per snapshot rather than sorting
  // every rendered frame of every angle during a long recording.
  let ordered = orderedTimelineClips.get(clips);
  if (!ordered || ordered.length !== clips.length) {
    ordered = [...clips].sort(
      (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
    );
    orderedTimelineClips.set(clips, ordered);
  }
  let low = 0,
    high = ordered.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ordered[middle].timelineStartSeconds <= timelineSeconds)
      low = middle + 1;
    else high = middle;
  }
  // The index refers to an element of the original generic array.
  const candidate = ordered[low - 1] as TClip | undefined;
  if (!candidate) return null;
  const clipTimeSeconds = timelineSeconds - candidate.timelineStartSeconds;
  if (
    typeof candidate.durationSeconds === 'number' &&
    clipTimeSeconds >= candidate.durationSeconds
  ) {
    return null;
  }
  return { clip: candidate, clipTimeSeconds };
};
