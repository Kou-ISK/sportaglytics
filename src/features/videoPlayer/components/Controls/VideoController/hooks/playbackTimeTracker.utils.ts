import type { VideoSyncData } from '../../../../../../types/VideoSync';

interface PlaybackTrackerPlayer {
  currentTime?: (time?: number) => number | void | undefined;
  duration?: () => number | undefined;
}

interface ResolveActualPlaybackTimeParams {
  primaryTime: number;
  secondaryTime: number;
  primaryDuration: number;
  videoTime: number;
  maxSec: number;
  syncData?: VideoSyncData;
}

export const resolveMaxAllowedTime = (maxSec: number): number => {
  return maxSec > 0 ? maxSec + 10 : 7200;
};

export const resolvePlayerDuration = (
  player?: PlaybackTrackerPlayer,
): number => {
  try {
    const duration = player?.duration?.();
    return typeof duration === 'number' && !Number.isNaN(duration)
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
    if (typeof rawTime !== 'number' || Number.isNaN(rawTime) || rawTime < 0) {
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

export const resolveActualPlaybackTime = ({
  primaryTime,
  secondaryTime,
  primaryDuration,
  videoTime,
  maxSec,
  syncData,
}: ResolveActualPlaybackTimeParams): number | null => {
  const offset = Number(syncData?.syncOffset || 0);
  const negOffset = !!(syncData?.isAnalyzed && offset < 0);
  const posOffset = !!(syncData?.isAnalyzed && offset > 0);

  let actualTime = primaryTime;

  if (negOffset) {
    if (primaryTime > 0) {
      actualTime = primaryTime;
    } else if (secondaryTime > 0 && videoTime < Math.abs(offset)) {
      actualTime = Math.min(Math.abs(offset), videoTime);
    }
  } else if (posOffset) {
    if (secondaryTime > 0 && videoTime >= offset) {
      actualTime = secondaryTime + offset;
    } else if (primaryTime > 0 && videoTime < offset) {
      actualTime = Math.min(offset, videoTime);
    } else if (primaryTime >= primaryDuration - 0.01 && secondaryTime > 0) {
      actualTime = secondaryTime + offset;
    }
  }

  if (
    !(actualTime > 0) ||
    actualTime >= 3600 ||
    actualTime > resolveMaxAllowedTime(maxSec)
  ) {
    return null;
  }

  return actualTime;
};

export const shouldApplyActualPlaybackTime = (
  nextVideoTime: number,
  previousVideoTime: number,
): boolean => {
  return Math.abs(nextVideoTime - previousVideoTime) > 0.01;
};
