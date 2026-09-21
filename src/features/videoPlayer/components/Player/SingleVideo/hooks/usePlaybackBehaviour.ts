import { useEffect } from 'react';
import type Player from 'video.js/dist/types/player';

interface UsePlaybackBehaviourParams {
  playerRef: React.MutableRefObject<Player | null>;
  id: string;
  isReady: boolean;
  isVideoPlaying: boolean;
  blockPlay: boolean;
  videoPlayBackRate: number;
  durationSec: number;
  setShowEndMask: (value: boolean) => void;
  allowSeek: boolean;
}

const getVideoElement = (player: Player | null): HTMLVideoElement | null => {
  const root = player?.el?.();
  if (!root) return null;
  return root.querySelector('video');
};

export const usePlaybackBehaviour = ({
  playerRef,
  id,
  isReady,
  isVideoPlaying,
  blockPlay,
  videoPlayBackRate,
  durationSec,
  setShowEndMask,
  allowSeek,
}: UsePlaybackBehaviourParams): void => {
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady) {
      return;
    }

    if (blockPlay) {
      player.pause();
      return;
    }

    if (!isVideoPlaying) {
      player.pause();
      return;
    }

    let cancelled = false;
    let waiting = false;
    const clearReadyListener = (): void => {
      player.off('canplay', handleReady);
      waiting = false;
    };
    const handleReady = (): void => {
      clearReadyListener();
      tryPlay();
    };
    const waitForData = (): void => {
      if (cancelled || waiting) return;
      waiting = true;
      player.on('canplay', handleReady);
    };
    const tryPlay = (): void => {
      if (cancelled || player.isDisposed() || !player.paused()) return;
      const tech = getVideoElement(player);
      if (tech && tech.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        waitForData();
        return;
      }
      const attempt = player.play();
      if (attempt)
        void attempt
          .then(() => {
            if (!cancelled && !player.isDisposed() && id !== 'video_0')
              player.muted(true);
          })
          .catch(() => {
            if (!cancelled && !player.isDisposed()) {
              const current = getVideoElement(player);
              if (
                current &&
                current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
              )
                waitForData();
            }
          });
    };
    tryPlay();
    return () => {
      cancelled = true;
      clearReadyListener();
    };
  }, [playerRef, isReady, blockPlay, isVideoPlaying, id]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady) {
      return;
    }
    if (player.playbackRate() !== videoPlayBackRate) {
      player.playbackRate(videoPlayBackRate);
    }
  }, [playerRef, videoPlayBackRate, isReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady || durationSec <= 0) {
      setShowEndMask(false);
      return;
    }

    if (allowSeek) {
      setShowEndMask(false);
      return;
    }

    const handleTimeUpdate = () => {
      const t = player.currentTime?.() ?? 0;
      setShowEndMask(t >= durationSec - 0.08);
    };

    player.on?.('timeupdate', handleTimeUpdate);
    return () => {
      player.off?.('timeupdate', handleTimeUpdate);
    };
  }, [playerRef, isReady, durationSec, setShowEndMask, allowSeek]);
};
