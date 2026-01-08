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
  const safeVideoList = Array.isArray(videoList) ? videoList : [];
  const {
    primaryClock,
    adjustedCurrentTimes,
    blockPlayStates,
    isSeekingRef,
    setPrimaryClock,
    lastReportedTimeRef,
  } = useSyncPlayback({
    videoList: safeVideoList,
    syncData,
    isVideoPlaying,
    forceUpdateKey,
    syncMode,
  });

  const { aspectRatios, handleAspectRatioChange } =
    useVideoAspectRatios(safeVideoList);

  const activeVideoCount = useMemo(
    () =>
      safeVideoList.filter((filePath) => filePath && filePath.trim() !== '')
        .length,
    [safeVideoList],
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
