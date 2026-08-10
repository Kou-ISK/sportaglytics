import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import {
  resolveTimelineClip,
  usesVirtualClipTimeline,
} from '../../../../../types/package/clipTimeline';
import {
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  resolvePlaybackAngleOffset,
  type VideoSyncData,
} from '../../../../../types/video/sync';
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
  mediaAngles: PackageMediaAngle[],
  syncData: VideoSyncData,
  currentGlobalTime: number,
): void => {
  videoList.forEach((_, index) => {
    const player = getVideoJsPlayer(`video_${index}`);
    if (!player) {
      return;
    }

    const angle = mediaAngles[index];
    const usesVirtualTimeline = usesVirtualClipTimeline(angle?.clips ?? []);
    const offset = resolvePlaybackAngleOffset({
      syncData,
      angleIndex: index,
      syncMode: 'auto',
      usesVirtualTimeline,
    });

    let targetTime: number;
    if (usesVirtualTimeline && angle) {
      const active = resolveTimelineClip(angle.clips, currentGlobalTime);
      if (!active) {
        player.pause?.();
        return;
      }
      targetTime = active.clipTimeSeconds;
    } else {
      targetTime = clampAngleMediaTime(
        globalTimeToAngleMediaTime(currentGlobalTime, offset),
      );
    }

    player.pause?.();
    setVideoJsPlayerCurrentTime(player, targetTime);
  });
};
