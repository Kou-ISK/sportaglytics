import {
  MAX_PACKAGE_TIMELINE_SECONDS,
  resolveTimelineClip,
} from '../../../../types/package/clipTimeline';
import type { PackageMediaClip } from '../../../../types/package/metadata';

const PLAYER_ALIGNMENT_TOLERANCE_SECONDS = 2;

export const calculatePrimaryTimelineEnd = (
  clips: PackageMediaClip[],
): number =>
  clips.reduce(
    (maximum, clip) =>
      Math.max(
        maximum,
        clip.timelineStartSeconds + (clip.durationSeconds ?? 0),
      ),
    0,
  );

export const arePrimaryTimelineDurationsKnown = (
  clips: PackageMediaClip[],
): boolean =>
  clips.length > 0 &&
  clips.every((clip) => typeof clip.durationSeconds === 'number');

const resolveNextClipStart = (
  clips: PackageMediaClip[],
  currentGlobalTime: number,
): number | undefined =>
  clips
    .map((clip) => clip.timelineStartSeconds)
    .filter((start) => start > currentGlobalTime)
    .sort((left, right) => left - right)[0];

export const advancePrimaryTimelineClock = ({
  currentGlobalTime,
  elapsedSeconds,
  playbackRate,
  clips,
  observedPrimaryMediaTime,
}: {
  currentGlobalTime: number;
  elapsedSeconds: number;
  playbackRate: number;
  clips: PackageMediaClip[];
  observedPrimaryMediaTime: number | null;
}): number => {
  const active = resolveTimelineClip(clips, currentGlobalTime);

  if (active) {
    if (
      observedPrimaryMediaTime === null ||
      !Number.isFinite(observedPrimaryMediaTime) ||
      observedPrimaryMediaTime < 0
    ) {
      return currentGlobalTime;
    }

    // A clip switch remounts video_0. Ignore a stale player observation until
    // the new source has reached the expected position on its clip timeline.
    if (
      Math.abs(observedPrimaryMediaTime - active.clipTimeSeconds) >
      PLAYER_ALIGNMENT_TOLERANCE_SECONDS
    ) {
      return currentGlobalTime;
    }

    const observedGlobalTime =
      active.clip.timelineStartSeconds + observedPrimaryMediaTime;
    const clipEnd =
      typeof active.clip.durationSeconds === 'number'
        ? active.clip.timelineStartSeconds + active.clip.durationSeconds
        : undefined;
    const nextClipStart = resolveNextClipStart(
      clips,
      active.clip.timelineStartSeconds,
    );
    const upperBound = Math.min(
      clipEnd ?? MAX_PACKAGE_TIMELINE_SECONDS,
      nextClipStart ?? MAX_PACKAGE_TIMELINE_SECONDS,
      MAX_PACKAGE_TIMELINE_SECONDS,
    );

    return Math.max(
      active.clip.timelineStartSeconds,
      Math.min(upperBound, observedGlobalTime),
    );
  }

  const elapsed = Math.max(0, elapsedSeconds) * Math.max(0, playbackRate);
  const nextClipStart = resolveNextClipStart(clips, currentGlobalTime);
  return Math.min(
    MAX_PACKAGE_TIMELINE_SECONDS,
    nextClipStart ?? MAX_PACKAGE_TIMELINE_SECONDS,
    currentGlobalTime + elapsed,
  );
};
