import type { VideoSyncData } from '../../../../../types/video/sync';
import {
  getVideoJsPlayer,
  getVideoJsPlayerCurrentTime,
  setVideoJsPlayerCurrentTime,
} from '../../../shared/videojs/videoJsAdapter';

const getPlayerTime = (id: string): number => {
  try {
    return getVideoJsPlayerCurrentTime(id) ?? 0;
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
    const player = getVideoJsPlayer(`video_${index}`);
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
    setVideoJsPlayerCurrentTime(player, targetTime);
  });
};
