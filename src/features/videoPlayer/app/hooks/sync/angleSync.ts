import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import { resolveMediaTime } from '../../../../../shared/media/mediaTimeline';

export interface AngleSyncPoint {
  clipId: string;
  sourceTime: number;
}

export interface AngleSyncDraft {
  angles: PackageMediaAngle[];
  offsets: number[];
}

export const syncPointTime = (
  angle: PackageMediaAngle,
  offset: number,
  point?: AngleSyncPoint,
): number | null => {
  const clip = angle.clips.find((item) => item.id === point?.clipId);
  return clip && point
    ? clip.timelineStartSeconds + point.sourceTime - offset
    : null;
};

/** Align the marked segment and its successors, preserving earlier periods. */
export const alignAngleSyncPoints = (
  draft: AngleSyncDraft,
  points: Record<string, AngleSyncPoint>,
): AngleSyncDraft => {
  const reference = draft.angles[0];
  const referenceTime = reference
    ? syncPointTime(reference, draft.offsets[0] ?? 0, points[reference.id])
    : null;
  if (referenceTime === null || draft.angles.length < 2)
    throw new Error('各アングルに同期点を設定してください。');
  const offsets = [...draft.offsets];
  const angles = draft.angles.map((angle, index) => {
    const point = points[angle.id];
    const pointTime = syncPointTime(angle, offsets[index] ?? 0, point);
    const selected = angle.clips.find((clip) => clip.id === point?.clipId);
    if (
      pointTime === null ||
      !selected ||
      !point ||
      !Number.isFinite(point.sourceTime) ||
      point.sourceTime < 0 ||
      (selected.durationSeconds !== undefined &&
        point.sourceTime >= selected.durationSeconds)
    )
      throw new Error(`${angle.name} の映像内に同期点を設定してください。`);
    const delta = referenceTime - pointTime;
    const ordered = [...angle.clips].sort(
      (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
    );
    const selectedIndex = ordered.findIndex((clip) => clip.id === selected.id);
    const shifted = ordered.map((clip, i) => ({
      ...clip,
      timelineStartSeconds:
        clip.timelineStartSeconds + (i >= selectedIndex ? delta : 0),
    }));
    // A leading trim is represented by the existing angle offset; disk starts stay nonnegative.
    const normalize = Math.max(0, -shifted[0].timelineStartSeconds);
    offsets[index] = (offsets[index] ?? 0) + normalize;
    let previousEnd = 0;
    const clips = shifted.map((clip) => {
      const start = clip.timelineStartSeconds + normalize;
      if (start < previousEnd - 0.001)
        throw new Error(
          `${angle.name} の前の区間と重なります。区切り位置と同期点を確認してください。`,
        );
      if (
        !Number.isFinite(start) ||
        start + (clip.durationSeconds ?? 0) > 86_400
      )
        throw new Error('同期後の映像が24時間を超えます。');
      const result = {
        ...clip,
        timelineStartSeconds: start,
        gapBeforeSeconds: Math.max(0, start - previousEnd),
      };
      previousEnd = start + (clip.durationSeconds ?? 0);
      return result;
    });
    return { ...angle, clips };
  });
  return { angles, offsets };
};

export const resolveAngleSyncTime = (
  angle: PackageMediaAngle,
  offset: number,
  time: number,
): ReturnType<typeof resolveMediaTime> =>
  resolveMediaTime({ clips: angle.clips, offsetSeconds: offset }, time);

export const angleSyncBounds = (
  angle: PackageMediaAngle,
  offset: number,
): { start: number; end: number } => ({
  start: Math.min(
    0,
    ...angle.clips.map((clip) => clip.timelineStartSeconds - offset),
  ),
  end: Math.max(
    0,
    ...angle.clips.map(
      (clip) =>
        clip.timelineStartSeconds + (clip.durationSeconds ?? 0) - offset,
    ),
  ),
});
