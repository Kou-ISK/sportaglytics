import { useCallback, useMemo } from 'react';
import type { SelectChangeEvent } from '@mui/material';
import type { VideoSyncData } from '../../../../../../types/VideoSync';
import type { GetExistingVideoJsPlayer } from './useExistingVideoJsPlayer';

interface UseVideoControllerControlsParams {
  setVideoPlayBackRate: React.Dispatch<React.SetStateAction<number>>;
  triggerFlash: (key: string) => void;
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  syncData?: VideoSyncData;
  maxSec: number;
  videoTime: number;
  setVideoTime: (value: number) => void;
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  getExistingPlayer: GetExistingVideoJsPlayer;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
}

export const useVideoControllerControls = ({
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
}: UseVideoControllerControlsParams) => {
  const speedOptions = useMemo(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 6], []);
  const SMALL_SKIP_SECONDS = 10;
  const LARGE_SKIP_SECONDS = 30;

  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleSpeedChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = Number(event.target.value);
      if (!Number.isNaN(value)) {
        setVideoPlayBackRate(value);
        triggerFlash(`speed-${value}`);
      }
    },
    [setVideoPlayBackRate, triggerFlash],
  );

  const handleSeekAdjust = useCallback(
    (deltaSeconds: number) => {
      const minAllowed =
        syncData?.isAnalyzed &&
        typeof syncData.syncOffset === 'number' &&
        syncData.syncOffset < 0
          ? syncData.syncOffset
          : 0;
      const maxAllowed =
        typeof maxSec === 'number' && maxSec > minAllowed
          ? maxSec
          : Number.POSITIVE_INFINITY;

      // videoTime状態ではなく、プレイヤーの実際のcurrentTime()から起点を取得
      let base = 0;
      try {
        const player = getExistingPlayer('video_0');
        if (player?.currentTime) {
          base = player.currentTime() ?? 0;
        } else {
          base = Number.isFinite(videoTime) ? videoTime : 0;
        }
      } catch {
        base = Number.isFinite(videoTime) ? videoTime : 0;
      }

      const target = base + deltaSeconds;
      const clamped = Math.min(maxAllowed, Math.max(minAllowed, target));
      lastManualSeekTimestamp.current = Date.now();
      setVideoTime(clamped);
      try {
        handleCurrentTime(new Event('video-controller-seek'), clamped);
      } catch {
        handleCurrentTime({} as React.SyntheticEvent, clamped);
      }
    },
    [
      videoTime,
      syncData,
      maxSec,
      handleCurrentTime,
      getExistingPlayer,
      lastManualSeekTimestamp,
      setVideoTime,
    ],
  );

  const togglePlayback = useCallback(() => {
    setIsVideoPlaying((prev) => !prev);
  }, [setIsVideoPlaying]);

  const handleSpeedPresetSelect = useCallback(
    (value: number) => {
      setVideoPlayBackRate(value);
    },
    [setVideoPlayBackRate],
  );

  const currentTimeLabel = useMemo(
    () => `${formatTime(videoTime)} / ${formatTime(maxSec)}`,
    [formatTime, maxSec, videoTime],
  );

  return {
    speedOptions,
    smallSkipSeconds: SMALL_SKIP_SECONDS,
    largeSkipSeconds: LARGE_SKIP_SECONDS,
    currentTimeLabel,
    onTogglePlayback: togglePlayback,
    onSeekAdjust: handleSeekAdjust,
    onSpeedPresetSelect: handleSpeedPresetSelect,
    onSpeedChange: handleSpeedChange,
  };
};
