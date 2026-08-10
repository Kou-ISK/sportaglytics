import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GetExistingVideoJsPlayer } from './useExistingVideoJsPlayer';
import {
  resolveObservedVideoTime,
  resolvePlayerDuration,
  shouldApplyObservedVideoTime,
} from './playbackTimeTracker.utils';

interface UsePlaybackClockSyncParams {
  videoList: string[];
  isVideoPlaying: boolean;
  getExistingPlayer: GetExistingVideoJsPlayer;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  safeSetCurrentTime: (time: number, source?: string) => void;
  videoTime: number;
  setVideoTime: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}

export const usePlaybackClockSync = ({
  videoList,
  isVideoPlaying,
  getExistingPlayer,
  lastManualSeekTimestamp,
  safeSetCurrentTime,
  videoTime,
  setVideoTime,
  disabled = false,
}: UsePlaybackClockSyncParams): void => {
  useEffect(() => {
    if (disabled || videoList.length === 0) {
      return;
    }

    let animationFrameId: number | undefined;

    const updateTimeHandler = () => {
      try {
        const primaryPlayer = getExistingPlayer('video_0');
        if (!primaryPlayer || !(resolvePlayerDuration(primaryPlayer) > 0)) {
          return;
        }

        const nextVideoTime = resolveObservedVideoTime(primaryPlayer);
        if (nextVideoTime === null) {
          return;
        }

        const timeSinceManualSeek =
          Date.now() - lastManualSeekTimestamp.current;
        if (
          shouldApplyObservedVideoTime(
            nextVideoTime,
            videoTime,
            timeSinceManualSeek,
          )
        ) {
          setVideoTime(nextVideoTime);
          safeSetCurrentTime(nextVideoTime, 'primary-clock');
        }
      } catch (error) {
        console.debug('プレイヤーアクセスエラー:', error);
      }
    };

    const animationUpdateHandler = () => {
      updateTimeHandler();
      animationFrameId = requestAnimationFrame(animationUpdateHandler);
    };

    const timer = globalThis.setTimeout(() => {
      const primaryPlayer = getExistingPlayer('video_0');
      if (!primaryPlayer) {
        return;
      }

      primaryPlayer.on?.('timeupdate', updateTimeHandler);
      if (isVideoPlaying) {
        animationFrameId = requestAnimationFrame(animationUpdateHandler);
      }
    }, 100);

    return () => {
      globalThis.clearTimeout(timer);
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
      }
      getExistingPlayer('video_0')?.off?.('timeupdate', updateTimeHandler);
    };
  }, [
    disabled,
    getExistingPlayer,
    isVideoPlaying,
    lastManualSeekTimestamp,
    safeSetCurrentTime,
    setVideoTime,
    videoList,
    videoTime,
  ]);
};
