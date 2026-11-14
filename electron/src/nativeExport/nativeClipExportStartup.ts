import { app } from 'electron';
import { publishHeldSource, supportsHeldPublicationVolume } from '../ipc/exportHeldPublish';
import path from 'node:path';
import { resolveVerifiedNativeResources } from '../nativePlayback/runtime/nativeResources';
import { detectNativeExportCapability } from './nativeExportCapabilities';
import { createMacClipExporter } from './macClipExporter';
import { estimateRequestBytes, NativeExportSourceChanged } from './nativeExportBudget';
import { requiresNativeV2Budget } from './nativeBudgetSelection';
import { nativeMinimumFreeBytes } from './nativeCapacityPolicy';
import { createExportResources, exportResourceContext } from '../ipc/exportResourceContext';
import { NativeExportCapacityError } from './nativeExportProcess';
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
      const verified = await resolveVerifiedNativeResources(
        process.resourcesPath,
        path.join(app.getPath('userData'), 'native-export'),
      ).catch(() => null);
      if (signal.aborted) throw new NativeExportCancelled();
      if (!verified) return { status: 'fallback', reason: 'native-unavailable' };
      const capability = await detectNativeExportCapability(verified.paths.host, verified.revision, signal);
      if (signal.aborted) throw new NativeExportCancelled();
      let budget: { maxBytes: number; deadlineSeconds: number } | undefined;
      let expectedSourceRevision: string | undefined;
      let resources: Awaited<ReturnType<typeof createExportResources>> | undefined;
      if (capability === 'budget-v2') return { status: 'fallback', reason: 'native-unavailable' };
      if (capability === 'budget-v2-held') {
        // Metadata admission happens before any native output exists. If it is
        // unavailable, keep the existing v1 path; cancellation remains terminal.
        const estimate = await estimateRequestBytes({ ...request, signal }).catch((error: unknown) => {
          if (signal.aborted) throw new NativeExportCancelled();
          if (error instanceof NativeExportSourceChanged) throw error;
          return undefined;
        });
        if (estimate !== undefined) expectedSourceRevision = estimate.sourceRevision;
        if (estimate !== undefined && requiresNativeV2Budget(estimate.bytes)) {
          if (!await supportsHeldPublicationVolume(verified.paths.host, path.dirname(request.outputPath), signal))
            return { status: 'fallback', reason: 'native-unavailable' };
          resources = await createExportResources(path.dirname(request.outputPath), signal, nativeMinimumFreeBytes(estimate.bytes), true);
          if (estimate.bytes > 32 * 1024 ** 3 || estimate.bytes > resources.maxFileBytes) throw new NativeExportCapacityError('Insufficient budget for native export');
          budget = { maxBytes: estimate.bytes, deadlineSeconds: 600 };
        }
      }
      const available = createMacClipExporter({ executable: verified.paths.host, qualify: qualifyNativeClip, stablePublish: (fd, target, signal) => publishHeldSource(verified.paths.host, fd, target, signal), experimentalBudget: budget, expectedSourceRevision });
      const invoke = () => available({ ...request, signal });
      const result = resources ? await exportResourceContext.run(resources, invoke) : await invoke();
      if (signal.aborted) throw new NativeExportCancelled();
      return result;
    })();
    active = operation;
    return operation.finally(() => {
      if (active === operation) active = undefined;
    });
  };
};
