import { useCallback, useRef } from 'react';
import { MAX_PACKAGE_TIMELINE_SECONDS } from '../../../../../../types/package/clipTimeline';
import { useFlashStates } from './useFlashStates';
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
  onSpeedChange: (
    event: import('@mui/material').SelectChangeEvent<string>,
  ) => void;
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
  useTimelineClock = false,
}: VideoControllerProps): VideoControllerToolbarProps => {
  const { flashStates, triggerFlash } = useFlashStates();
  const lastSetCurrentTimeValueRef = useRef<number>(0);
  const lastManualSeekTimestamp = useRef<number>(-Infinity);
  const hasVideos = videoList.some((path) => path && path.trim() !== '');

  const safeSetCurrentTime = useCallback(
    (time: number, source = 'unknown') => {
      const maxAllowedTime =
        maxSec > 0
          ? Math.min(MAX_PACKAGE_TIMELINE_SECONDS, maxSec + 1)
          : MAX_PACKAGE_TIMELINE_SECONDS;
      if (time > maxAllowedTime) {
        console.error(
          `[ERROR] safeSetCurrentTime from ${source}: 再生可能範囲外 (${time}秒、上限=${maxAllowedTime}秒) の設定を阻止しました。`,
        );
        return;
      }
      if (!Number.isFinite(time) || time < 0) {
        console.error(
          `[ERROR] safeSetCurrentTime from ${source}: 無効な値 (${time}) の設定を阻止しました。`,
        );
        return;
      }

      const timeDiff = Math.abs(time - lastSetCurrentTimeValueRef.current);
      const isClockTick = source === 'primary-clock';
      const shouldUpdate = isClockTick || timeDiff > 0.05;

      if (!shouldUpdate) {
        return;
      }

      lastSetCurrentTimeValueRef.current = time;
      setCurrentTime(time);
    },
    [maxSec, setCurrentTime],
  );

  const getExistingPlayer = useExistingVideoJsPlayer();

  const { videoTime, setVideoTime } = usePlaybackTimeTracker({
    videoList,
    isVideoPlaying,
    maxSec,
    getExistingPlayer,
    lastManualSeekTimestamp,
    safeSetCurrentTime,
    timelineClockTime: useTimelineClock ? currentTime : undefined,
  });

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
