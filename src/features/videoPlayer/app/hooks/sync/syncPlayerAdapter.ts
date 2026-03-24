import videojs from 'video.js';
import type { VideoSyncData } from '../../../../../types/VideoSync';

type VideoJsSyncPlayer = {
  currentTime?: (time?: number) => number | void;
  pause?: () => void;
};

type VideoJsNamespace = {
  getPlayer?: (id: string) => VideoJsSyncPlayer | undefined;
};

const getVideoJsNamespace = (): VideoJsNamespace => {
  return videojs as unknown as VideoJsNamespace;
};

const getPlayerTime = (id: string): number => {
  try {
    const currentTime = getVideoJsNamespace().getPlayer?.(id)?.currentTime?.();
    return typeof currentTime === 'number' && !Number.isNaN(currentTime)
      ? currentTime
      : 0;
  } catch {
    return 0;
  }
};

export const getPrimaryPlayerTime = (): number => {
  return getPlayerTime('video_0');
};

export const getManualSyncTimes = (): {
  primaryTime: number;
  secondaryTime: number;
} => {
  return {
    primaryTime: getPlayerTime('video_0'),
    secondaryTime: getPlayerTime('video_1'),
  };
};

export const syncPlayersToGlobalTime = (
  videoList: string[],
  syncData: VideoSyncData,
  currentGlobalTime: number,
): void => {
  videoList.forEach((_, index) => {
    const player = getVideoJsNamespace().getPlayer?.(`video_${index}`);
    if (!player) {
      return;
    }

    const offset =
      index > 0 && syncData.isAnalyzed ? syncData.syncOffset || 0 : 0;
    const targetTime = Math.max(
      0,
      currentGlobalTime + (index > 0 ? offset : 0),
    );

    player.pause?.();
    player.currentTime?.(targetTime);
  });
};
