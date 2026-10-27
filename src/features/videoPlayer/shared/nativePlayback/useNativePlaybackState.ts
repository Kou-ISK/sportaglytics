import { useSyncExternalStore } from 'react';
import {
  getNativePlayback,
  subscribeNativePlayback,
} from './nativePlaybackRegistry';
import type {
  NativePlaybackController,
  NativePlaybackState,
} from './nativePlaybackController';
const original: NativePlaybackState = {
  phase: 'original',
  time: 0,
  observation: null,
  error: null,
  originalPreviewTime: null,
};
const noSubscribe = (): (() => void) => () => {};
const noSnapshot = (): NativePlaybackState => original;
export const useNativePlaybackState = (): {
  controller: NativePlaybackController | null;
  state: NativePlaybackState;
} => {
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
  return { controller, state };
};
