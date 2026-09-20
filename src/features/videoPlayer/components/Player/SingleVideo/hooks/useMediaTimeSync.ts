import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type Player from 'video.js/dist/types/player';

/** Keep each file's clock aligned with the shared timeline, including paused seeks. */
export const useMediaTimeSync = (
  playerRef: MutableRefObject<Player | null>,
  ready: boolean,
  targetTime: number | undefined,
  playing: boolean,
): void => {
  useEffect(() => {
    const player = playerRef.current;
    if (
      !ready ||
      !player ||
      targetTime === undefined ||
      !Number.isFinite(targetTime)
    )
      return;
    const actual = player.currentTime() ?? 0;
    if (Math.abs(actual - targetTime) > (playing ? 0.15 : 0.015)) {
      player.currentTime(Math.max(0, targetTime));
    }
  }, [playerRef, ready, targetTime, playing]);
};
