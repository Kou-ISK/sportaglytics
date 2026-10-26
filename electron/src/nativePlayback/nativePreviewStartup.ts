import { app } from 'electron';
import path from 'node:path';
import { createNativeSourceProvider } from './nativeSourceProvider';
import type { NativePlaybackRuntime } from './nativeSourceProvider';

const isRuntime = (value: unknown): value is NativePlaybackRuntime =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  value.version === 1 &&
  (!('allowUnmutedTrial' in value) || value.allowUnmutedTrial === true) &&
  'probe' in value &&
  typeof value.probe === 'function' &&
  'createBackend' in value &&
  typeof value.createBackend === 'function';

/** Development preview only. This is a fixed build-local runtime, not a
 * renderer-selectable module, path or persistent application setting. Packaged
 * builds stay disabled until helper distribution and compatibility qualify. */
export const nativePreviewProvider = (
  buildRoot: string,
): ReturnType<typeof createNativeSourceProvider> | null => {
  if (
    app.isPackaged ||
    process.platform !== 'darwin' ||
    process.env.SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW !== '1'
  )
    return null;
  try {
    // Main is emitted at build/electron/src; the preview build owns this file.
    const value: unknown = require(
      path.join(buildRoot, '.native-playback/runtime.cjs'),
    );
    return isRuntime(value) ? createNativeSourceProvider(value) : null;
  } catch {
    return null;
  }
};
