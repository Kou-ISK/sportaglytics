import { useEffect } from 'react';
import { MAX_PACKAGE_TIMELINE_SECONDS } from '../../../../../../types/package/clipTimeline';
import { resolveMaxAllowedTime } from './playbackTimeTracker.utils';

interface UsePlaybackTimeWarningsParams {
  videoTime: number;
  maxSec: number;
}

export const usePlaybackTimeWarnings = ({
  videoTime,
  maxSec,
}: UsePlaybackTimeWarningsParams): void => {
  useEffect(() => {
    const maxAllowedTime = resolveMaxAllowedTime(maxSec);
    if (videoTime > maxAllowedTime) {
      console.warn(
        `[WARNING] videoTimeが再生可能範囲を超えています (${videoTime}秒、上限=${maxAllowedTime}秒)。`,
      );
    }
  }, [maxSec, videoTime]);

  useEffect(() => {
    if (maxSec > MAX_PACKAGE_TIMELINE_SECONDS) {
      console.error(
        `[ERROR] VideoController: maxSecが24時間上限を超えています (${maxSec}秒)。`,
      );
    }
  }, [maxSec]);
};
