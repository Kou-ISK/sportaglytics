import { app } from 'electron';
import path from 'node:path';
import { resolveNativeResources } from '../nativePlayback/runtime/nativeResources';
import { createMacClipExporter } from './macClipExporter';
import { qualifyNativeClip } from './nativeClipQualification';
import { NativeExportCancelled } from './nativeExportProcess';
import type {
  NativeClipExporter,
  NativeClipExportResult,
} from './nativeClipExport';

/** Fixed signed resource, no renderer switch or persistent user setting. */
export const nativeClipExportProvider = (): NativeClipExporter | undefined => {
  if (
    process.platform !== 'darwin' ||
    process.arch !== 'arm64' ||
    !app.isPackaged
  )
    return undefined;
  const shutdown = new AbortController();
  let active: Promise<NativeClipExportResult> | undefined;
  let quitWork: Promise<void> | undefined;
  app.on('will-quit', (event) => {
    const pending = active;
    shutdown.abort();
    if (pending) {
      event.preventDefault();
      // Quit has already passed document-save guards. Drain only this native
      // operation and its probes/staging before resuming the normal app quit.
      quitWork ??= pending
        .catch(() => undefined)
        .then(() => {
          quitWork = undefined;
          app.quit();
        });
    }
  });
  let exporter: Promise<NativeClipExporter | null> | undefined;
  return (request) => {
    const signal = request.signal
      ? AbortSignal.any([shutdown.signal, request.signal])
      : shutdown.signal;
    if (signal.aborted) return Promise.reject(new NativeExportCancelled());
    // Bound the optimization across all windows. A concurrent request retains
    // its existing encoder path rather than starting another native session.
    if (active)
      return Promise.resolve({ status: 'fallback', reason: 'native-busy' });
    const operation = (async (): Promise<NativeClipExportResult> => {
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
      const result = available
        ? await available({ ...request, signal })
        : { status: 'fallback' as const, reason: 'native-unavailable' };
      if (signal.aborted) throw new NativeExportCancelled();
      return result;
    })();
    active = operation;
    return operation.finally(() => {
      if (active === operation) active = undefined;
    });
  };
};
