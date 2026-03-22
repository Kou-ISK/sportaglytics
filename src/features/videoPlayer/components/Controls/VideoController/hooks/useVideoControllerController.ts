import { useCallback, useEffect, useRef } from 'react';
import { useFlashStates } from './useFlashStates';
import { useSeekCoordinator } from './useSeekCoordinator';
import { usePlaybackTimeTracker } from './usePlaybackTimeTracker';
import { useExistingVideoJsPlayer } from './useExistingVideoJsPlayer';
import { useVideoControllerControls } from './useVideoControllerControls';
import type { VideoControllerProps } from '../VideoController.types';

interface VideoControllerToolbarProps {
  hasVideos: boolean;
  isVideoPlaying: boolean;
  playbackRate: number;
  speedOptions: number[];
  flashStates: Record<string, boolean>;
  onTogglePlayback: () => void;
  onSeekAdjust: (deltaSeconds: number) => void;
  onSpeedPresetSelect: (value: number) => void;
  onSpeedChange: (event: import('@mui/material').SelectChangeEvent<string>) => void;
  triggerFlash: (key: string) => void;
  currentTimeLabel: string;
  smallSkipSeconds: number;
  largeSkipSeconds: number;
}

export const useVideoControllerController = ({
  setIsVideoPlaying,
  isVideoPlaying,
  setVideoPlayBackRate,
  videoPlayBackRate,
  setCurrentTime,
  currentTime,
  handleCurrentTime,
  maxSec,
  videoList,
  syncData,
}: VideoControllerProps): VideoControllerToolbarProps => {
  const { flashStates, triggerFlash } = useFlashStates();
  const isSeekingRef = useSeekCoordinator();
  const lastSetCurrentTimeValueRef = useRef<number>(0);
  const lastSetCurrentTimeTimestampRef = useRef<number>(0);
  const isVideoPlayingRef = useRef<boolean>(isVideoPlaying);
  const lastManualSeekTimestamp = useRef<number>(-Infinity);
  const hasVideos = videoList.some((path) => path && path.trim() !== '');

  useEffect(() => {
    isVideoPlayingRef.current = isVideoPlaying;
  }, [isVideoPlaying]);

  const safeSetCurrentTime = useCallback(
    (time: number, source = 'unknown') => {
      const maxAllowedTime = maxSec > 0 ? maxSec + 10 : 7200;
      if (time > maxAllowedTime) {
        console.error(
          `[ERROR] safeSetCurrentTime from ${source}: 異常に高い値 (${time}秒、上限=${maxAllowedTime}秒) の設定を阻止しました。`,
        );
        return;
      }
      if (isNaN(time) || time < 0) {
        console.error(
          `[ERROR] safeSetCurrentTime from ${source}: 無効な値 (${time}) の設定を阻止しました。`,
        );
        return;
      }

      const now = Date.now();
      const timeDiff = Math.abs(time - lastSetCurrentTimeValueRef.current);
      const isSyncTick = source.startsWith('RAF');
      const shouldUpdate =
        isSyncTick || source === 'updateTimeHandler' || timeDiff > 0.05;

      if (!shouldUpdate) {
        return;
      }

      lastSetCurrentTimeValueRef.current = time;
      lastSetCurrentTimeTimestampRef.current = now;
      setCurrentTime(time);
    },
    [maxSec, setCurrentTime],
  );

  const prevCurrentTimeRef = useRef<number>(currentTime);
  useEffect(() => {
    if (currentTime === prevCurrentTimeRef.current) {
      return;
    }

    lastManualSeekTimestamp.current = Date.now();
    prevCurrentTimeRef.current = currentTime;
  }, [currentTime]);

  const getExistingPlayer = useExistingVideoJsPlayer();

  const { videoTime, setVideoTime } = usePlaybackTimeTracker({
    videoList,
    isVideoPlaying,
    maxSec,
    syncData,
    getExistingPlayer,
    lastManualSeekTimestamp,
    isSeekingRef,
    safeSetCurrentTime,
  });

  useEffect(() => {
    if (!isVideoPlaying || videoList.length === 0) {
      return;
    }

    const tryPlayAll = () => {
      const basePlayer = getExistingPlayer('video_0');
      const useSlider = !!(
        syncData?.isAnalyzed &&
        (syncData?.syncOffset ?? 0) < 0 &&
        videoTime < 0
      );

      let baseTime = 0;
      try {
        baseTime = useSlider
          ? videoTime
          : basePlayer?.currentTime
            ? basePlayer.currentTime() || videoTime
            : videoTime;
      } catch {
        baseTime = videoTime;
      }

      let localOffset = 0;
      if (syncData?.isAnalyzed) {
        localOffset = syncData.syncOffset || 0;
      } else if (videoList.length > 1) {
        const secondaryPlayer = getExistingPlayer('video_1');
        let secondaryTime = 0;
        try {
          secondaryTime = secondaryPlayer?.currentTime
            ? secondaryPlayer.currentTime() || 0
            : 0;
        } catch {
          secondaryTime = 0;
        }
        localOffset =
          (basePlayer?.currentTime ? basePlayer.currentTime() || 0 : 0) -
          secondaryTime;
      }

      videoList.forEach((_, index) => {
        try {
          const player = getExistingPlayer(`video_${index}`);
          if (!player || player.isDisposed?.()) {
            return;
          }

          const readyState = player.readyState?.() ?? 0;
          if (index > 0) {
            const targetTime = Math.max(0, baseTime + localOffset);
            try {
              (
                player as unknown as {
                  currentTime?: (time?: number) => number;
                }
              ).currentTime?.(targetTime);
            } catch {
              /* noop */
            }
          }

          const playNow = () => {
            const playResult = player.play?.();
            if (
              playResult &&
              typeof (playResult as Promise<unknown>).catch === 'function'
            ) {
              (playResult as Promise<unknown>).catch(() => undefined);
            }
          };

          const delayMs =
            index > 0 && localOffset > baseTime
              ? Math.max(0, (localOffset - baseTime) * 1000)
              : 0;

          if (readyState >= 1) {
            if (delayMs > 0) {
              globalThis.setTimeout(playNow, delayMs);
            } else {
              playNow();
            }
            return;
          }

          const onReady = () => {
            if (index > 0) {
              const targetTime = Math.max(0, baseTime - localOffset);
              try {
                (
                  player as unknown as {
                    currentTime?: (time?: number) => number;
                  }
                ).currentTime?.(targetTime);
              } catch {
                /* noop */
              }
            }

            if (delayMs > 0) {
              globalThis.setTimeout(playNow, delayMs);
            } else {
              playNow();
            }
            player.off?.('loadedmetadata', onReady);
            player.off?.('canplay', onReady);
          };

          player.on?.('loadedmetadata', onReady);
          player.on?.('canplay', onReady);
        } catch {
          /* noop */
        }
      });
    };

    const timer = globalThis.setTimeout(tryPlayAll, 150);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [
    getExistingPlayer,
    isVideoPlaying,
    syncData?.isAnalyzed,
    syncData?.syncOffset,
    videoList,
    videoTime,
  ]);

  const {
    speedOptions,
    smallSkipSeconds,
    largeSkipSeconds,
    currentTimeLabel,
    onTogglePlayback,
    onSeekAdjust,
    onSpeedPresetSelect,
    onSpeedChange,
  } = useVideoControllerControls({
    setVideoPlayBackRate,
    triggerFlash,
    setIsVideoPlaying,
    syncData,
    maxSec,
    videoTime,
    setVideoTime,
    handleCurrentTime,
    getExistingPlayer,
    lastManualSeekTimestamp,
  });

  return {
    hasVideos,
    isVideoPlaying,
    playbackRate: videoPlayBackRate,
    speedOptions,
    flashStates,
    onTogglePlayback,
    onSeekAdjust,
    onSpeedPresetSelect,
    onSpeedChange,
    triggerFlash,
    currentTimeLabel,
    smallSkipSeconds,
    largeSkipSeconds,
  };
};
