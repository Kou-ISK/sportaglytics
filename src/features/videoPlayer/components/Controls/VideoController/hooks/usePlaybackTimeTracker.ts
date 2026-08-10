import { useEffect, useState } from 'react';
import type { GetExistingVideoJsPlayer } from './useExistingVideoJsPlayer';
import { usePlaybackClockSync } from './usePlaybackClockSync';
import { usePlaybackTimeWarnings } from './usePlaybackTimeWarnings';

interface Params {
  videoList: string[];
  isVideoPlaying: boolean;
  maxSec: number;
  getExistingPlayer: GetExistingVideoJsPlayer;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  safeSetCurrentTime: (time: number, source?: string) => void;
  timelineClockTime?: number;
}

export const usePlaybackTimeTracker = ({
  videoList,
  isVideoPlaying,
  maxSec,
  getExistingPlayer,
  lastManualSeekTimestamp,
  safeSetCurrentTime,
  timelineClockTime,
}: Params) => {
  const [videoTime, setVideoTime] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(videoTime) || videoTime < 0) {
      setVideoTime(0);
    }
  }, [videoTime]);

  useEffect(() => {
    if (timelineClockTime !== undefined) {
      setVideoTime(timelineClockTime);
    }
  }, [timelineClockTime]);

  usePlaybackTimeWarnings({ videoTime, maxSec });
  usePlaybackClockSync({
    videoList,
    isVideoPlaying,
    getExistingPlayer,
    lastManualSeekTimestamp,
    safeSetCurrentTime,
    videoTime,
    setVideoTime,
    disabled: timelineClockTime !== undefined,
  });

  return { videoTime, setVideoTime };
};
