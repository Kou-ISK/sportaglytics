import { app } from 'electron';
import path from 'node:path';
import { createNativeSourceProvider } from './nativeSourceProvider';
import type { NativePlaybackRuntime } from './nativeSourceProvider';
import { resolveNativeResources } from './runtime/nativeResources';
import { createNativePlaybackRuntime } from './runtime/nativeRuntime';

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

/** Explicit launch-only preview. Missing/unqualified resources keep the old
 * player. No renderer-selectable module/path or persistent setting. */
export const nativePreviewProvider = (
  buildRoot: string,
): ReturnType<typeof createNativeSourceProvider> | null => {
  if (
    process.platform !== 'darwin' ||
    process.env.SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW !== '1'
  )
    return null;
  if (app.isPackaged) {
    if (process.arch !== 'arm64') return null;
    let provider: Promise<ReturnType<
      typeof createNativeSourceProvider
    > | null> | null = null;
    return async (window) => {
      provider ??= resolveNativeResources(
        process.resourcesPath,
        path.join(app.getPath('userData'), 'native-preview'),
      )
        .then((paths) =>
          createNativeSourceProvider(createNativePlaybackRuntime(paths)),
        )
        .catch(() => null);
      return (await provider)?.(window) ?? null;
    };
  }
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
