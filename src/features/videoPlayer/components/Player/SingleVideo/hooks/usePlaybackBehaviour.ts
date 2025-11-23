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
}: UsePlaybackBehaviourParams) => {
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

    const tryPlay = () => {
      const targetPlayer = playerRef.current;
      if (!targetPlayer || targetPlayer.paused() === false) {
        return;
      }

      const techEl = getVideoElement(targetPlayer);
      if (!techEl || techEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        const handleCanPlay = () => {
          techEl?.removeEventListener('canplay', handleCanPlay);
          tryPlay();
        };

        if (techEl) {
          techEl.addEventListener('canplay', handleCanPlay, { once: true });
        } else {
          targetPlayer.one?.('canplay', () => tryPlay());
        }
        return;
      }

      const playAttempt = targetPlayer.play();
      if (
        playAttempt &&
        typeof (playAttempt as Promise<unknown>).then === 'function' &&
        typeof (playAttempt as Promise<unknown>).catch === 'function'
      ) {
        (playAttempt as Promise<unknown>)
          .then(() => {
            // 音声同期: video_0のみ音声再生、video_1以降は常にミュート
            // これにより音の重複（エコー）を防ぐ
            if (id !== 'video_0') {
              targetPlayer.muted(true);
            }
          })
          .catch(() => {
            const retryTech = getVideoElement(targetPlayer);
            if (
              !retryTech ||
              retryTech.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
              const handleCanPlayRetry = () => {
                retryTech?.removeEventListener('canplay', handleCanPlayRetry);
                tryPlay();
              };

              if (retryTech) {
                retryTech.addEventListener('canplay', handleCanPlayRetry, {
                  once: true,
                });
              } else {
                targetPlayer.one?.('canplay', () => tryPlay());
              }
            }
          });
      }
    };

    tryPlay();
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

    const handleTimeUpdate = () => {
      const t = player.currentTime?.() ?? 0;
      setShowEndMask(t >= durationSec - 0.08);
    };

    player.on?.('timeupdate', handleTimeUpdate);
    return () => {
      player.off?.('timeupdate', handleTimeUpdate);
    };
  }, [playerRef, isReady, durationSec, setShowEndMask]);
};
