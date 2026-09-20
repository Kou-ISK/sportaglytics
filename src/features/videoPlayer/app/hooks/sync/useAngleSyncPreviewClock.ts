import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface PreviewClockPlayer {
  currentTime: (seconds?: number) => number | undefined;
  isDisposed: () => boolean;
  paused: () => boolean;
  pause: () => void;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
}

interface PreviewClockParams {
  playerRef: RefObject<PreviewClockPlayer | null>;
  source: string;
  time: number | null;
  ready: boolean;
  playing: boolean;
  suspended: boolean;
  error: string;
  play: () => void;
}

/** Source replacement can reset currentTime after the React readiness update. */
export const useAngleSyncPreviewClock = (params: PreviewClockParams): void => {
  const current = useRef(params);
  current.current = params;
  const apply = useCallback((): void => {
    const state = current.current;
    const player = state.playerRef.current;
    if (!state.ready || state.suspended || !player || player.isDisposed())
      return;
    if (state.time === null || state.error) {
      player.pause();
      return;
    }
    if (
      Math.abs((player.currentTime() ?? 0) - state.time) >
      (state.playing ? 0.08 : 0.00005)
    )
      player.currentTime(state.time);
    if (state.playing && player.paused()) state.play();
    else if (!state.playing && !player.paused()) player.pause();
  }, []);

  useEffect(apply, [
    apply,
    params.time,
    params.playing,
    params.suspended,
    params.ready,
    params.error,
    params.source,
  ]);
  useEffect(() => {
    const player = params.playerRef.current;
    if (!player) return;
    // Chromium/Video.js may finish replacing the source after loadedmetadata.
    // Reconcile on media readiness/seek completion, even when React state is unchanged.
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked'];
    events.forEach((event) => player.on(event, apply));
    return () => {
      if (!player.isDisposed())
        events.forEach((event) => player.off(event, apply));
    };
  }, [apply, params.playerRef, params.source]);
};
