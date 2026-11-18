import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import type { QualifiedNativeSource } from './nativePlaybackManager';
import type { NativePlaybackGroupSelection } from '../../../src/types/ipc/nativePlaybackGroup';
import { createNativeGroupSourceProvider } from './nativeGroupSourceProvider';
import { probeNativeHeader } from './nativeHeaderProbe';
import path from 'node:path';
import { createNativeSourceProvider } from './nativeSourceProvider';
import type { NativePlaybackRuntime } from './nativeSourceProvider';
import { resolveNativeResources, resolveSignedNativeGroupResources } from './runtime/nativeResources';
import { createNativePlaybackRuntime } from './runtime/nativeRuntime';

const isRuntime = (value: unknown): value is NativePlaybackRuntime =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  value.version === 1 &&
  'probe' in value &&
  typeof value.probe === 'function' &&
  'createBackend' in value &&
  typeof value.createBackend === 'function';

/** Automatically qualify supported sources. Missing/unqualified resources retain
 * compatible original playback. No renderer-selectable path or saved setting. */
export const nativePlaybackProvider = (
  buildRoot: string,
): ((window: BrowserWindow, selection?: NativePlaybackGroupSelection) => Promise<QualifiedNativeSource | null>) | null => {
  if (process.platform !== 'darwin') return null;
  if (app.isPackaged) {
    if (process.arch !== 'arm64') return null;
    let provider: Promise<ReturnType<
      typeof createNativeSourceProvider
    > | null> | null = null;
    const groupProvider = createNativeGroupSourceProvider(async () => {
      const resources = await resolveSignedNativeGroupResources(process.resourcesPath,
        path.join(app.getPath('userData'), 'native-preview'), new AbortController().signal);
      return { ...resources, probe: probeNativeHeader };
    });
    return async (window, selection) => {
      if (selection) return groupProvider(window, selection);
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
    if (!isRuntime(value)) return null;
    const legacy = createNativeSourceProvider(value);
    // Unsigned preview runtimes do not declare a production group capability.
    return (window, selection) => selection ? Promise.resolve(null) : legacy(window);
  } catch {
    return null;
  }
};
