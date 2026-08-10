import { useEffect } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { usesVirtualClipTimeline } from '../../../../types/package/clipTimeline';
import {
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  resolvePlaybackAngleOffset,
  type VideoSyncData,
} from '../../../../types/video/sync';
import {
  getVideoJsPlayer,
  getVideoJsPlayerCurrentTime,
  setVideoJsPlayerCurrentTime,
} from '../../shared/videojs/videoJsAdapter';

type ManualSyncSeekParams = {
  syncMode: 'auto' | 'manual';
  syncData?: VideoSyncData;
  videoList: string[];
  mediaAngles: PackageMediaAngle[];
};

export const useManualSyncSeek = ({
  syncMode,
  syncData,
  videoList,
  mediaAngles,
}: ManualSyncSeekParams): void => {
  useEffect(() => {
    if (syncMode !== 'manual' || videoList.length < 2) {
      return;
    }

    try {
      const primaryPlayer = getVideoJsPlayer('video_0');
      const secondaryPlayer = getVideoJsPlayer('video_1');
      if (!primaryPlayer || !secondaryPlayer) {
        return;
      }

      const primaryTime = getVideoJsPlayerCurrentTime(primaryPlayer) ?? 0;
      const secondaryOffset = resolvePlaybackAngleOffset({
        syncData,
        angleIndex: 1,
        // Enter manual mode from the current automatic playback alignment.
        syncMode: 'auto',
        usesVirtualTimeline: usesVirtualClipTimeline(
          mediaAngles[1]?.clips ?? [],
        ),
      });
      const secondaryTime = clampAngleMediaTime(
        globalTimeToAngleMediaTime(primaryTime, secondaryOffset),
      );
      setVideoJsPlayerCurrentTime(secondaryPlayer, secondaryTime);
    } catch (error) {
      console.error('手動モード開始時のシークエラー:', error);
    }
  }, [mediaAngles, syncMode, syncData, videoList]);
};
