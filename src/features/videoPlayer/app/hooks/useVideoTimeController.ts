import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import {
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  resolvePlaybackAngleOffset,
  type VideoSyncData,
} from '../../../../types/video/sync';
import {
  getVideoJsPlayer,
  setVideoJsPlayerCurrentTime,
} from '../../shared/videojs/videoJsAdapter';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import {
  resolveTimelineClip,
  usesVirtualClipTimeline,
} from '../../../../types/package/clipTimeline';

type UseVideoTimeControllerParams = {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  syncMode: 'auto' | 'manual';
  mediaAngles: PackageMediaAngle[];
};

const dispatchSeekEvent = (
  type: 'video-seek-start' | 'video-seek-end',
  time?: number,
): void => {
  if (type === 'video-seek-start') {
    globalThis.window.dispatchEvent(
      new CustomEvent(type, { detail: { time } }),
    );
    return;
  }

  globalThis.window.dispatchEvent(new CustomEvent(type));
};

const seekEachPlayer = ({
  globalTime,
  videoList,
  syncData,
  syncMode,
  mediaAngles,
}: {
  globalTime: number;
  videoList: string[];
  syncData: VideoSyncData | undefined;
  syncMode: 'auto' | 'manual';
  mediaAngles: PackageMediaAngle[];
}): void => {
  videoList.forEach((_, index) => {
    try {
      const player = getVideoJsPlayer(`video_${index}`);
      if (
        !player ||
        !player.el?.() ||
        player.isDisposed?.() === true ||
        player.error?.()
      ) {
        return;
      }

      const angle = mediaAngles[index];
      const usesVirtualTimeline =
        syncMode === 'auto' && usesVirtualClipTimeline(angle?.clips ?? []);
      const offset = resolvePlaybackAngleOffset({
        syncData,
        angleIndex: index,
        syncMode,
        usesVirtualTimeline,
      });

      let targetTime: number;
      if (usesVirtualTimeline && angle) {
        const active = resolveTimelineClip(angle.clips, globalTime);
        if (!active) {
          player.pause?.();
          return;
        }
        targetTime = active.clipTimeSeconds;
      } else {
        targetTime = clampAngleMediaTime(
          globalTimeToAngleMediaTime(globalTime, offset),
        );
      }

      const durationCandidate = player.duration?.();
      const duration =
        typeof durationCandidate === 'number' &&
        Number.isFinite(durationCandidate)
          ? durationCandidate
          : 0;
      if (!(duration > 0)) {
        return;
      }

      try {
        setVideoJsPlayerCurrentTime(player, targetTime);
      } catch (seekError) {
        console.debug(`Failed to seek video_${index}:`, seekError);
      }
    } catch (error) {
      console.debug(`Failed to process video_${index}:`, error);
    }
  });
};

export const useVideoTimeController = ({
  videoList,
  syncData,
  syncMode,
  mediaAngles,
}: UseVideoTimeControllerParams): {
  currentTime: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  handleCurrentTime: (
    event: SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
} => {
  const [currentTime, setCurrentTime] = useState(0);

  const handleCurrentTime = useCallback(
    (_event: SyntheticEvent | Event, newValue: number | number[]) => {
      const rawTime = Array.isArray(newValue) ? newValue[0] : newValue;
      const time = Number(rawTime);

      dispatchSeekEvent('video-seek-start', time);

      if (!Number.isFinite(time) || time < 0) {
        console.warn('Invalid global time value:', rawTime);
        setCurrentTime(0);
        dispatchSeekEvent('video-seek-end');
        return;
      }

      const globalTime = Math.max(0, time);
      setCurrentTime(globalTime);

      globalThis.setTimeout(() => {
        seekEachPlayer({
          globalTime,
          videoList,
          syncData,
          syncMode,
          mediaAngles,
        });

        globalThis.setTimeout(() => {
          dispatchSeekEvent('video-seek-end');
        }, 500);
      }, 50);
    },
    [mediaAngles, syncData, syncMode, videoList],
  );

  return {
    currentTime,
    setCurrentTime,
    handleCurrentTime,
  };
};
