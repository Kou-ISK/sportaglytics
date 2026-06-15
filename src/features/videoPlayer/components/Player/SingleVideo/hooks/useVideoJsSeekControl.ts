import { useEffect } from 'react';
import type Player from 'video.js/dist/types/player';

interface UseVideoJsSeekControlParams {
  allowSeek: boolean;
  playerRef: React.MutableRefObject<Player | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}

export const useVideoJsSeekControl = ({
  allowSeek,
  playerRef,
  videoRef,
}: UseVideoJsSeekControlParams) => {
  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const progressControl = (
      player as Player & {
        controlBar?: { progressControl?: { el?: () => Element | null } };
      }
    ).controlBar?.progressControl?.el?.();
    if (progressControl instanceof HTMLElement) {
      progressControl.style.pointerEvents = allowSeek ? 'auto' : 'none';
      progressControl.style.opacity = allowSeek ? '1' : '0.6';
    }

    try {
      player.controls?.(allowSeek);
    } catch {
      /* noop */
    }

    const videoEl = videoRef.current;
    if (videoEl) {
      if (allowSeek) {
        videoEl.setAttribute('controls', '');
      } else {
        videoEl.removeAttribute('controls');
      }
    }
  }, [allowSeek, playerRef, videoRef]);
};
