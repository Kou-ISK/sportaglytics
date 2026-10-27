import type { NativePlaybackController } from './nativePlaybackController';
let controller: NativePlaybackController | null = null;
const listeners = new Set<() => void>();
export const getNativePlayback = (): NativePlaybackController | null =>
  controller;
export const subscribeNativePlayback = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const bindNativePlayback = (
  value: NativePlaybackController,
): (() => void) => {
  if (controller) throw Error('NATIVE_ALREADY_BOUND');
  controller = value;
  for (const listener of listeners) listener();
  return () => {
    if (controller !== value) return;
    if (value.snapshot().phase !== 'original')
      throw Error('NATIVE_RECOVERY_REQUIRED');
    controller = null;
    for (const listener of listeners) listener();
  };
};

/** Call before changing source/mode so the old HTML port survives restoration. */
export const restoreNativeBeforeDocumentChange = async (): Promise<void> => {
  const active = getNativePlayback();
  if (!active) return;
  active.controls({ playing: false });
  await active.returnToOriginal();
};
