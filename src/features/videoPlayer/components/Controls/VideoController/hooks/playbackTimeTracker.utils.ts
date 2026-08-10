import { MAX_PACKAGE_TIMELINE_SECONDS } from '../../../../../../types/package/clipTimeline';

interface PlaybackTrackerPlayer {
  currentTime?: (time?: number) => number | void | undefined;
  duration?: () => number | undefined;
}

export const resolveMaxAllowedTime = (maxSec: number): number => {
  if (!(maxSec > 0)) {
    return MAX_PACKAGE_TIMELINE_SECONDS;
  }
  return Math.min(MAX_PACKAGE_TIMELINE_SECONDS, maxSec + 1);
};

export const resolvePlayerDuration = (
  player?: PlaybackTrackerPlayer,
): number => {
  try {
    const duration = player?.duration?.();
    return typeof duration === 'number' && Number.isFinite(duration)
      ? duration
      : 0;
  } catch {
    return 0;
  }
};

export const resolveObservedVideoTime = (
  player?: PlaybackTrackerPlayer,
): number | null => {
  try {
    const rawTime = player?.currentTime?.() ?? 0;
    if (
      typeof rawTime !== 'number' ||
      !Number.isFinite(rawTime) ||
      rawTime < 0 ||
      rawTime > MAX_PACKAGE_TIMELINE_SECONDS
    ) {
      return null;
    }
    return rawTime;
  } catch {
    return null;
  }
};

export const shouldApplyObservedVideoTime = (
  nextVideoTime: number,
  previousVideoTime: number,
  timeSinceManualSeek: number,
): boolean => {
  const threshold = timeSinceManualSeek < 100 ? 0.05 : 0.1;
  return Math.abs(nextVideoTime - previousVideoTime) > threshold;
};
