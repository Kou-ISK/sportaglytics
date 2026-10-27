import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { Dispatch, SetStateAction } from 'react';
import {
  getNativePlayback,
  subscribeNativePlayback,
} from '../../shared/nativePlayback/nativePlaybackRegistry';
import type {
  NativePlaybackControls,
  NativePlaybackState,
} from '../../shared/nativePlayback/nativePlaybackController';

/** Recovery calls this outside React after the stopped original frame is ready.
 * Commit all shared inputs while native still owns HTML playback, so releasing
 * that ownership cannot make media effects seek to an earlier React snapshot. */
export const useNativePlaybackRestoration = (
  setTime: Dispatch<SetStateAction<number>>,
  setRate: Dispatch<SetStateAction<number>>,
  setPlaying: Dispatch<SetStateAction<boolean>>,
): ((time: number, controls: NativePlaybackControls) => void) =>
  useCallback(
    (time, controls) => {
      flushSync(() => {
        setTime(time);
        setRate(controls.rate);
        setPlaying(controls.playing);
      });
    },
    [setTime, setRate, setPlaying],
  );
const empty: NativePlaybackState = {
  phase: 'original',
  time: 0,
  observation: null,
  error: null,
  originalPreviewTime: null,
};
const noSubscribe = (): (() => void) => () => {};
const noSnapshot = (): NativePlaybackState => empty;
export const useNativePackageClock = (
  eligibleSource: string | null,
  playing: boolean,
  rate: number,
  setTime: Dispatch<SetStateAction<number>>,
  setPlaying: Dispatch<SetStateAction<boolean>>,
): boolean => {
  const controller = useSyncExternalStore(
    subscribeNativePlayback,
    getNativePlayback,
    getNativePlayback,
  );
  const state = useSyncExternalStore(
    controller?.subscribe ?? noSubscribe,
    controller?.snapshot ?? noSnapshot,
    noSnapshot,
  );
  useEffect(() => {
    if (!controller) return;
    if (eligibleSource !== controller.sourceUrl) {
      controller.fail('NATIVE_SOURCE_CHANGED');
      setPlaying(false);
      return;
    }
    controller.controls({ playing, rate });
  }, [controller, eligibleSource, playing, rate, setPlaying, state.phase]);
  useEffect(() => {
    if (!controller) return;
    // This is observation, never an input seek. The existing shared currentTime
    // continues to drive tags, save position and the timeline controller.
    if (eligibleSource === controller.sourceUrl && state.observation)
      setTime(state.time);
    if (state.phase === 'failed' || state.phase === 'closing') {
      if (!controller.isFallingBack || state.phase === 'failed')
        setPlaying(false);
      if (eligibleSource === controller.sourceUrl) setTime(state.time);
    }
  }, [controller, eligibleSource, state, setTime, setPlaying]);
  useEffect(
    () => () => {
      controller?.fail('NATIVE_CLOCK_UNMOUNTED');
    },
    [controller],
  );
  return controller !== null;
};
