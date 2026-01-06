import { useMemo } from 'react';
import { useSyncPlayback } from './useSyncPlayback';
import { useVideoAspectRatios } from './useVideoAspectRatios';
import type { SyncedVideoPlayerProps } from '../types';

export const useSyncedVideoPlayer = ({
  videoList,
  syncData,
  isVideoPlaying,
  forceUpdateKey = 0,
  syncMode,
}: SyncedVideoPlayerProps) => {
  const {
    primaryClock,
    adjustedCurrentTimes,
    blockPlayStates,
    isSeekingRef,
    setPrimaryClock,
    lastReportedTimeRef,
  } = useSyncPlayback({
    videoList,
    syncData,
    isVideoPlaying,
    forceUpdateKey,
    syncMode,
  });

  const { aspectRatios, handleAspectRatioChange } =
    useVideoAspectRatios(videoList);

  const activeVideoCount = useMemo(
    () =>
      videoList.filter((filePath) => filePath && filePath.trim() !== '').length,
    [videoList],
  );

  return {
    primaryClock,
    adjustedCurrentTimes,
    blockPlayStates,
    isSeekingRef,
    setPrimaryClock,
    lastReportedTimeRef,
    aspectRatios,
    handleAspectRatioChange,
    activeVideoCount,
  };
};
