import { useCallback, useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import type { VideoSyncData } from '../../types/VideoSync';

type UseVideoTimeControllerParams = {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  syncMode: 'auto' | 'manual';
  isDev: boolean;
};

type VideoJsPlayer = {
  el?: () => Element | null;
  isDisposed?: () => boolean;
  error?: () => unknown;
  duration?: () => number | undefined;
  currentTime?: (time?: number) => number | undefined;
};

type VideoJsNamespace = {
  getPlayer?: (id: string) => VideoJsPlayer | undefined;
};

const getMinAllowedGlobalTime = (syncData: VideoSyncData | undefined): number => {
  if (
    syncData &&
    syncData.isAnalyzed &&
    typeof syncData.syncOffset === 'number' &&
    syncData.syncOffset < 0
  ) {
    return syncData.syncOffset;
  }

  return 0;
};

const dispatchSeekEvent = (type: 'video-seek-start' | 'video-seek-end', time?: number): void => {
  if (type === 'video-seek-start') {
    window.dispatchEvent(new CustomEvent(type, { detail: { time } }));
    return;
  }

  window.dispatchEvent(new CustomEvent(type));
};

const seekEachPlayer = ({
  timeClamped,
  videoList,
  syncData,
  isManualMode,
  isDev,
}: {
  timeClamped: number;
  videoList: string[];
  syncData: VideoSyncData | undefined;
  isManualMode: boolean;
  isDev: boolean;
}): void => {
  const namespace = videojs as unknown as VideoJsNamespace;

  videoList.forEach((_, index) => {
    try {
      const player = namespace.getPlayer?.(`video_${index}`);
      if (
        !player ||
        !player.el?.() ||
        player.isDisposed?.() === true ||
        player.error?.()
      ) {
        return;
      }

      const durationCandidate = player.duration?.();
      const duration =
        typeof durationCandidate === 'number' && !Number.isNaN(durationCandidate)
          ? durationCandidate
          : 0;

      if (!(duration > 0)) {
        return;
      }

      let targetTime = timeClamped;

      if (index === 0) {
        targetTime = Math.max(getMinAllowedGlobalTime(syncData), timeClamped);
      }

      if (index > 0 && syncData?.isAnalyzed && !isManualMode) {
        const offset = syncData.syncOffset || 0;
        targetTime = Math.max(0, timeClamped + offset);

        console.log(
          `[OFFSET DEBUG] video_${index}: global=${timeClamped.toFixed(3)}s, ` +
            `offset=${offset.toFixed(3)}s, target=${targetTime.toFixed(3)}s ` +
            `(calc: ${timeClamped.toFixed(3)} + ${offset.toFixed(3)} = ${targetTime.toFixed(3)})`,
        );
      }

      if (isDev) {
        console.log(
          `Seek: Video ${index} -> ${targetTime}s (global=${timeClamped}, offset=${
            syncData?.syncOffset ?? 0
          })`,
        );
      }

      try {
        player.currentTime?.(targetTime);
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
  isDev,
}: UseVideoTimeControllerParams) => {
  const [currentTime, setCurrentTime] = useState(0);
  const prevCurrentTimeRef = useRef<number>(0);

  useEffect(() => {
    if (currentTime > 7200 && prevCurrentTimeRef.current !== currentTime) {
      console.warn(
        `[WARNING] currentTime is unusually high (${currentTime}s, limit=7200s).`,
      );
    }
    prevCurrentTimeRef.current = currentTime;
  }, [currentTime]);

  const handleCurrentTime = useCallback(
    (_event: React.SyntheticEvent | Event, newValue: number | number[]) => {
      const time = newValue as number;
      const isManualMode = syncMode === 'manual';
      const minAllowed = getMinAllowedGlobalTime(syncData);

      dispatchSeekEvent('video-seek-start', time);

      if (Number.isNaN(time) || time < minAllowed) {
        console.warn('Invalid time value:', time);
        setCurrentTime(minAllowed);
        return;
      }

      const timeClamped = Math.max(time, minAllowed);
      setCurrentTime(timeClamped);

      setTimeout(() => {
        seekEachPlayer({
          timeClamped,
          videoList,
          syncData,
          isManualMode,
          isDev,
        });

        setTimeout(() => {
          dispatchSeekEvent('video-seek-end');
        }, 500);
      }, 50);
    },
    [isDev, syncData, syncMode, videoList],
  );

  return {
    currentTime,
    setCurrentTime,
    handleCurrentTime,
  };
};
