import { useEffect, useState } from 'react';
import type { VideoSyncData } from '../../../../../../types/VideoSync';
import type { GetExistingVideoJsPlayer } from './useExistingVideoJsPlayer';
import { usePlaybackClockSync } from './usePlaybackClockSync';
import { usePlaybackTimeWarnings } from './usePlaybackTimeWarnings';

interface Params {
  videoList: string[];
  isVideoPlaying: boolean;
  maxSec: number;
  syncData?: VideoSyncData;
  getExistingPlayer: GetExistingVideoJsPlayer;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  safeSetCurrentTime: (time: number, source?: string) => void;
}

export const usePlaybackTimeTracker = ({
  videoList,
  isVideoPlaying,
  maxSec,
  syncData,
  getExistingPlayer,
  lastManualSeekTimestamp,
  safeSetCurrentTime,
}: Params) => {
  const [videoTime, setVideoTime] = useState(0);

  useEffect(() => {
    if (isNaN(videoTime)) {
      setVideoTime(0);
    }
  }, [videoTime]);

  usePlaybackTimeWarnings({ videoTime, maxSec });
  usePlaybackClockSync({
    videoList,
    isVideoPlaying,
    maxSec,
    syncData,
    getExistingPlayer,
    lastManualSeekTimestamp,
    safeSetCurrentTime,
    videoTime,
    setVideoTime,
  });

  return { videoTime, setVideoTime };
};
