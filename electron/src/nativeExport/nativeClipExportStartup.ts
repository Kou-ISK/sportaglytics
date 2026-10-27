import { app } from 'electron';
import path from 'node:path';
import { resolveNativeResources } from '../nativePlayback/runtime/nativeResources';
import { createMacClipExporter } from './macClipExporter';
import { qualifyNativeClip } from './nativeClipQualification';
import { NativeExportCancelled } from './nativeExportProcess';
import type { NativeClipExporter } from './nativeClipExport';

/** Fixed signed resource, no renderer switch or persistent user setting. */
export const nativeClipExportProvider = (): NativeClipExporter | undefined => {
  if (
    process.platform !== 'darwin' ||
    process.arch !== 'arm64' ||
    !app.isPackaged
  )
    return undefined;
  const shutdown = new AbortController();
  app.once('will-quit', () => shutdown.abort());
  let busy = false;
  let exporter: Promise<NativeClipExporter | null> | undefined;
  return async (request) => {
    const signal = request.signal
      ? AbortSignal.any([shutdown.signal, request.signal])
      : shutdown.signal;
    if (signal.aborted) throw new NativeExportCancelled();
    // Bound the optimization across all windows. A concurrent request retains
    // its existing encoder path rather than starting another native session.
    if (busy) return { status: 'fallback', reason: 'native-busy' };
    busy = true;
    try {
      exporter ??= resolveNativeResources(
        process.resourcesPath,
        path.join(app.getPath('userData'), 'native-export'),
      )
        .then(({ host }) =>
          createMacClipExporter({
            executable: host,
            qualify: qualifyNativeClip,
          }),
        )
        .catch(() => null);
      const available = await exporter;
      if (signal.aborted) throw new NativeExportCancelled();
      return available
        ? await available({ ...request, signal })
        : { status: 'fallback', reason: 'native-unavailable' };
    } finally {
      busy = false;
    }
  };
};
