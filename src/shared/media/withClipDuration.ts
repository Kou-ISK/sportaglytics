import type { PackageMediaClip } from '../../types/package/metadata';

/** Resolve unmeasured sequential sources without moving an already placed segment. */
export const withClipDuration = (
  clips: PackageMediaClip[],
  clipId: string,
  duration: number,
): PackageMediaClip[] => {
  const target = clips.find((clip) => clip.id === clipId);
  if (
    !target ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    Math.abs((target.durationSeconds ?? 0) - duration) < 0.01
  )
    return clips;
  let previousEnd = 0;
  let resolveFollowing = false;
  return clips.map((clip) => {
    const next =
      clip.id === clipId ? { ...clip, durationSeconds: duration } : { ...clip };
    if (resolveFollowing && next.timelineStartSeconds < previousEnd)
      next.timelineStartSeconds = previousEnd + next.gapBeforeSeconds;
    previousEnd = next.timelineStartSeconds + (next.durationSeconds ?? 0);
    if (clip.id === clipId && target.durationSeconds === undefined)
      resolveFollowing = true;
    return next;
  });
};
