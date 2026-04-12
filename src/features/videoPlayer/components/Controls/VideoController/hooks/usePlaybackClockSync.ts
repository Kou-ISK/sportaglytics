import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../../types/VideoSync';
import type { GetExistingVideoJsPlayer } from './useExistingVideoJsPlayer';
import {
  resolveActualPlaybackTime,
  resolveObservedVideoTime,
  resolvePlayerDuration,
  shouldApplyActualPlaybackTime,
  shouldApplyObservedVideoTime,
} from './playbackTimeTracker.utils';

interface UsePlaybackClockSyncParams {
  videoList: string[];
  isVideoPlaying: boolean;
  maxSec: number;
  syncData?: VideoSyncData;
  getExistingPlayer: GetExistingVideoJsPlayer;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  safeSetCurrentTime: (time: number, source?: string) => void;
  videoTime: number;
  setVideoTime: Dispatch<SetStateAction<number>>;
}

export const usePlaybackClockSync = ({
  videoList,
  isVideoPlaying,
  maxSec,
  syncData,
  getExistingPlayer,
  lastManualSeekTimestamp,
  safeSetCurrentTime,
  videoTime,
  setVideoTime,
}: UsePlaybackClockSyncParams): void => {
  const rafLastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (videoList.length === 0) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let animationFrameId: number | undefined;

    const updateTimeHandler = () => {
      try {
        const primaryPlayer = getExistingPlayer('video_0');
        if (!primaryPlayer) {
          return;
        }

        const duration = resolvePlayerDuration(primaryPlayer);
        if (!(duration > 0)) {
          return;
        }

        const nextVideoTime = resolveObservedVideoTime(primaryPlayer);
        if (nextVideoTime === null) {
          return;
        }

        if (
          syncData?.isAnalyzed &&
          (syncData.syncOffset ?? 0) < 0 &&
          videoTime < 0
        ) {
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
          safeSetCurrentTime(nextVideoTime, 'updateTimeHandler');
        }
      } catch (error) {
        console.debug('プレイヤーアクセスエラー:', error);
      }
    };

    const animationUpdateHandler = (ts?: number) => {
      if (typeof ts === 'number') {
        if (rafLastTsRef.current == null) {
          rafLastTsRef.current = ts;
        }
        rafLastTsRef.current = ts;

        if (isVideoPlaying) {
          try {
            const primaryPlayer = getExistingPlayer('video_0');
            const secondaryPlayer = getExistingPlayer('video_1');
            const primaryTime = resolveObservedVideoTime(primaryPlayer) ?? 0;
            const secondaryTime =
              resolveObservedVideoTime(secondaryPlayer) ?? 0;
            const primaryDuration = resolvePlayerDuration(primaryPlayer);

            const actualTime = resolveActualPlaybackTime({
              primaryTime,
              secondaryTime,
              primaryDuration,
              videoTime,
              maxSec,
              syncData,
            });

            if (
              actualTime !== null &&
              shouldApplyActualPlaybackTime(actualTime, videoTime)
            ) {
              setVideoTime(actualTime);
              safeSetCurrentTime(actualTime, 'RAF-actualTime');
            }
          } catch {
            /* noop */
          }
        }
      }

      updateTimeHandler();
      animationFrameId = requestAnimationFrame(animationUpdateHandler);
    };

    const timer = globalThis.setTimeout(() => {
      try {
        const primaryPlayer = getExistingPlayer('video_0');
        if (!primaryPlayer) {
          return;
        }

        primaryPlayer.on?.('timeupdate', updateTimeHandler);

        if (isVideoPlaying) {
          rafLastTsRef.current = null;
          animationFrameId = requestAnimationFrame(animationUpdateHandler);
        }

        intervalId = setInterval(updateTimeHandler, 200);
      } catch (error) {
        console.debug('プレイヤー初期化待機中:', error);
      }
    }, 100);

    return () => {
      globalThis.clearTimeout(timer);
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      getExistingPlayer('video_0')?.off?.('timeupdate', updateTimeHandler);
    };
  }, [
    getExistingPlayer,
    isVideoPlaying,
    lastManualSeekTimestamp,
    maxSec,
    safeSetCurrentTime,
    setVideoTime,
    syncData,
    videoList,
    videoTime,
  ]);
};
