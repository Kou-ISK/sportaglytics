import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
interface ClockPlayer {
  currentTime: (time?: number) => number | undefined;
  seeking: () => boolean;
  on: (event: string, listener: () => void) => unknown;
  off: (event: string, listener: () => void) => unknown;
}

/** Coalesce seeks while decoding; native playback advances between corrections. */
export const useMediaTimeSync = (
  playerRef: MutableRefObject<ClockPlayer | null>,
  ready: boolean,
  targetTime: number | undefined,
  playing: boolean,
  rate = 1,
): void => {
  const latest = useRef({ targetTime, playing, rate, ready });
  const lastRequestedTime = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (
      latest.current.targetTime !== targetTime ||
      latest.current.playing !== playing
    )
      lastRequestedTime.current = undefined;
    latest.current = { targetTime, playing, rate, ready };
  }, [targetTime, playing, rate, ready]);
  const force = useRef(true);
  const lastSeekAt = useRef(-Infinity);
  const sync = useCallback((): void => {
    const player = playerRef.current;
    const state = latest.current;
    if (
      !state.ready ||
      !player ||
      state.targetTime === undefined ||
      !Number.isFinite(state.targetTime) ||
      (player.seeking() && !force.current)
    )
      return;
    const now = performance.now();
    const forced = force.current;
    const precise = forced || !state.playing;
    const tolerance = precise ? 0.015 : 0.15 * Math.max(1, state.rate);
    if (!precise && now - lastSeekAt.current < 250) return;
    force.current = false;
    if (Math.abs((player.currentTime() ?? 0) - state.targetTime) <= tolerance) {
      // A completed seek may later be reset by the source's load restoration.
      // Only an unresolved request is suppressed; an aligned frame can drift again.
      lastRequestedTime.current = undefined;
      return;
    }
    // A decoder may clamp a target before its first frame. Repeating that
    // unchanged paused request from seeked/canplay would restart decoding forever.
    if (
      !state.playing &&
      !forced &&
      lastRequestedTime.current === state.targetTime
    )
      return;
    lastSeekAt.current = now;
    lastRequestedTime.current = state.targetTime;
    player.currentTime(Math.max(0, state.targetTime));
  }, [playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    force.current = true;
    lastSeekAt.current = -Infinity;
    lastRequestedTime.current = undefined;
    const requestSeek = (): void => {
      force.current = true;
    };
    const settled = (): void => {
      lastSeekAt.current = performance.now();
      sync();
    };
    const loaded = (): void => {
      // Some decoders reset the initial metadata seek when the first frame arrives.
      force.current = true;
      sync();
    };
    player.on('seeked', settled);
    player.on('loadeddata', loaded);
    player.on('canplay', sync);
    window.addEventListener('video-seek-start', requestSeek);
    sync();
    return () => {
      player.off('seeked', settled);
      player.off('loadeddata', loaded);
      player.off('canplay', sync);
      window.removeEventListener('video-seek-start', requestSeek);
    };
  }, [playerRef, ready, sync]);

  useEffect(sync, [sync, ready, targetTime, playing, rate]);
};
