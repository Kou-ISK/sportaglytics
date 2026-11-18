import { parseNativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import type { NativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import type { NativePlaybackController } from './nativePlaybackController';
let controller: NativePlaybackController | null = null;
let group: NativePlaybackGroupBinding | null = null;
export const getNativePlaybackGroup = (): NativePlaybackGroupBinding | null =>
  group;
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
  binding?: NativePlaybackGroupBinding,
): (() => void) => {
  if (controller) throw Error('NATIVE_ALREADY_BOUND');
  const parsed = binding ? parseNativePlaybackGroupBinding(binding) : null;
  controller = value;
  group = parsed;
  for (const listener of listeners) listener();
  return () => {
    if (controller !== value) return;
    if (value.snapshot().phase !== 'original')
      throw Error('NATIVE_RECOVERY_REQUIRED');
    controller = null;
    group = null;
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
