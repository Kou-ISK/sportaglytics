import { useEffect } from 'react';
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
        `[WARNING] videoTimeが異常に高い値 (${videoTime}秒、上限=${maxAllowedTime}秒) です。`,
      );
    }
  }, [maxSec, videoTime]);

  useEffect(() => {
    if (maxSec > 7200) {
      console.error(
        `[ERROR] VideoController: 異常に高いmaxSec (${maxSec}秒) が設定されています。`,
      );
    }
  }, [maxSec]);
};
