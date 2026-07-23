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
}: {
  referenceStartSeconds: number;
  referenceCurrentSeconds: number;
  targetCurrentSeconds: number;
}): number =>
  referenceStartSeconds + referenceCurrentSeconds - targetCurrentSeconds;

export const resolveTimelineClip = <
  TClip extends {
    timelineStartSeconds: number;
    durationSeconds?: number;
  },
>(
  clips: TClip[],
  timelineSeconds: number,
): { clip: TClip; clipTimeSeconds: number } | null => {
  const ordered = [...clips].sort(
    (left, right) => left.timelineStartSeconds - right.timelineStartSeconds,
  );
  const candidate = ordered.reduce<TClip | undefined>((selected, clip) => {
    if (clip.timelineStartSeconds > timelineSeconds) return selected;
    if (
      !selected ||
      clip.timelineStartSeconds > selected.timelineStartSeconds
    ) {
      return clip;
    }
    return selected;
  }, undefined);
  if (!candidate) return null;
  const clipTimeSeconds = timelineSeconds - candidate.timelineStartSeconds;
  if (
    typeof candidate.durationSeconds === 'number' &&
    clipTimeSeconds >= candidate.durationSeconds
  ) {
    return null;
  }
  const nextClip = ordered.find(
    (clip) => clip.timelineStartSeconds > candidate.timelineStartSeconds,
  );
  if (nextClip && timelineSeconds >= nextClip.timelineStartSeconds) {
    return null;
  }
  return { clip: candidate, clipTimeSeconds };
};
