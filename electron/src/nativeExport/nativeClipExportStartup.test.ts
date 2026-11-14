// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { supportsHeldPublicationVolume } from '../ipc/exportHeldPublish';
import { app } from 'electron';
import { resolveVerifiedNativeResources } from '../nativePlayback/runtime/nativeResources';
import { detectNativeExportCapability } from './nativeExportCapabilities';
import { createMacClipExporter } from './macClipExporter';
import { estimateRequestBytes } from './nativeExportBudget';
import { nativeMinimumFreeBytes } from './nativeCapacityPolicy';
import { createExportResources, exportResourceContext } from '../ipc/exportResourceContext';
import { nativeClipExportProvider } from './nativeClipExportStartup';
import type { NativeClipExportResult } from './nativeClipExport';

const state = vi.hoisted(() => ({
  onQuit: undefined as
    | ((event: { preventDefault(): void }) => void)
    | undefined,
}));
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: () => '/test-state',
    quit: vi.fn(),
    on: (_event: string, fn: (event: { preventDefault(): void }) => void) => {
      state.onQuit = fn;
    },
  },
}));
vi.mock('../nativePlayback/runtime/nativeResources', () => ({
  resolveVerifiedNativeResources: vi.fn(),
}));
vi.mock('../ipc/exportHeldPublish', () => ({ publishHeldSource: vi.fn(), supportsHeldPublicationVolume: vi.fn() }));
vi.mock('./nativeExportCapabilities', () => ({ detectNativeExportCapability: vi.fn() }));
vi.mock('./nativeExportBudget', async (original) => { const actual = await original<typeof import('./nativeExportBudget')>(); return { ...actual, estimateRequestBytes: vi.fn() }; });
vi.mock('../ipc/exportResourceContext', async (original) => { const actual = await original<typeof import('../ipc/exportResourceContext')>(); return { ...actual, createExportResources: vi.fn() }; });
vi.mock('./macClipExporter', () => ({ createMacClipExporter: vi.fn() }));
vi.mock('./nativeClipQualification', () => ({ qualifyNativeClip: vi.fn() }));
const request = {
  sourcePath: 'original.mp4',
  outputPath: 'output.mp4',
  start: 3,
  duration: 5,
  audioTrack: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.onQuit = undefined;
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64');
  Object.defineProperty(process, 'resourcesPath', {
    value: '/signed-resources',
    configurable: true,
  });
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 8, paths: {
    host: 'signed-host',
    receiver: 'receiver',
    state: 'state',
  } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('legacy-v1');
  vi.mocked(supportsHeldPublicationVolume).mockResolvedValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});
it('does not enable unsigned development or other platforms', () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
  expect(nativeClipExportProvider()).toBeUndefined();
  expect(resolveVerifiedNativeResources).not.toHaveBeenCalled();
  expect(detectNativeExportCapability).not.toHaveBeenCalled();
  expect(createMacClipExporter).not.toHaveBeenCalled();
  expect(supportsHeldPublicationVolume).not.toHaveBeenCalled();
});
it('falls back when fixed signed resources cannot be verified', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockRejectedValue(
    Error('signature mismatch'),
  );
  expect(await nativeClipExportProvider()?.(request)).toEqual({
    status: 'fallback',
    reason: 'native-unavailable',
  });
  expect(createMacClipExporter).not.toHaveBeenCalled();
});
it('bounds native concurrency to one across all windows and releases on completion', async () => {
  let finish: ((value: NativeClipExportResult) => void) | undefined;
  const run = vi.fn(
    () =>
      new Promise<NativeClipExportResult>((resolve) => {
        finish = resolve;
      }),
  );
  vi.mocked(createMacClipExporter).mockReturnValue(run);
  const provider = nativeClipExportProvider();
  const first = provider?.(request);
  await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(await provider?.(request)).toEqual({
    status: 'fallback',
    reason: 'native-busy',
  });
  finish?.({ status: 'completed' });
  expect(await first).toEqual({ status: 'completed' });
  run.mockResolvedValue({ status: 'completed' });
  expect(await provider?.(request)).toEqual({ status: 'completed' });
  expect(resolveVerifiedNativeResources).toHaveBeenCalledTimes(2);
});
it('propagates app shutdown and forbids later fallback or publication work', async () => {
  let active: AbortSignal | undefined;
  vi.mocked(createMacClipExporter).mockReturnValue(async (value) => {
    active = value.signal;
    return { status: 'completed' };
  });
  const provider = nativeClipExportProvider();
  await provider?.(request);
  state.onQuit?.({ preventDefault: vi.fn() });
  expect(active?.aborted).toBe(true);
  await expect(provider?.(request)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(app.isPackaged).toBe(true);
});
it('holds normal quit until the active operation and metadata probes drain', async () => {
  let finish: (() => void) | undefined;
  const run = vi.fn(
    () =>
      new Promise<NativeClipExportResult>((resolve) => {
        finish = () =>
          resolve({ status: 'fallback', reason: 'cancelled-test-double' });
      }),
  );
  vi.mocked(createMacClipExporter).mockReturnValue(run);
  const provider = nativeClipExportProvider();
  const active = provider?.(request).catch((error: unknown) => error);
  await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  const preventDefault = vi.fn();
  state.onQuit?.({ preventDefault });
  state.onQuit?.({ preventDefault });
  state.onQuit?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(3);
  expect(app.quit).not.toHaveBeenCalled();
  finish?.();
  expect(await active).toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(app.quit).toHaveBeenCalledOnce());
});

it('passes a verified v2 long-clip budget and resource context to the exporter', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 9, paths: { host: 'signed-host', receiver: 'receiver', state: 'state' } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  vi.mocked(estimateRequestBytes).mockResolvedValue({ bytes: 17_350_000_000, sourceRevision: 'fingerprint' });
  const resources = { maxFileBytes: 20_000_000_000, minFreeBytes: 30_000_000_000, signal: new AbortController().signal, check: vi.fn() };
  vi.mocked(createExportResources).mockResolvedValue(resources);
  vi.mocked(createMacClipExporter).mockReturnValue(async () => { expect(exportResourceContext.getStore()).toBe(resources); return { status: 'completed' }; });
  expect(await nativeClipExportProvider()?.(request)).toEqual({ status: 'completed' });
  expect(createMacClipExporter).toHaveBeenCalledWith(expect.objectContaining({ experimentalBudget: { maxBytes: 17_350_000_000, deadlineSeconds: 600 } }));
  expect(createExportResources).toHaveBeenCalledWith('.', expect.any(AbortSignal), nativeMinimumFreeBytes(17_350_000_000), true);
});
it('rejects a long v2 request when the finite capacity is insufficient', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 9, paths: { host: 'signed-host', receiver: 'receiver', state: 'state' } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  vi.mocked(estimateRequestBytes).mockResolvedValue({ bytes: 17_350_000_000, sourceRevision: 'fingerprint' });
  vi.mocked(createExportResources).mockResolvedValue({ maxFileBytes: 10_000_000_000, minFreeBytes: 30_000_000_000, signal: new AbortController().signal, check: vi.fn() });
  await expect(nativeClipExportProvider()?.(request)).rejects.toMatchObject({ name: 'NativeExportCapacityError' });
  expect(createMacClipExporter).not.toHaveBeenCalled();
});
it('never selects v2 when capability is unverified', async () => {
  vi.mocked(detectNativeExportCapability).mockRejectedValue(new Error('bad capability'));
  await expect(nativeClipExportProvider()?.(request)).rejects.toThrow('bad capability');
  expect(estimateRequestBytes).not.toHaveBeenCalled();
});
it('keeps legacy admission when metadata is unavailable before native output starts', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 9, paths: { host: 'signed-host', receiver: 'receiver', state: 'state' } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  vi.mocked(estimateRequestBytes).mockRejectedValue(new Error('missing bitrate'));
  vi.mocked(createMacClipExporter).mockReturnValue(async () => ({ status: 'fallback', reason: 'unsupported-request' }));
  expect(await nativeClipExportProvider()?.(request)).toEqual({ status: 'fallback', reason: 'unsupported-request' });
  expect(createMacClipExporter).toHaveBeenCalledWith(expect.objectContaining({ experimentalBudget: undefined }));
});
it('does not fall back after cancellation during metadata inspection', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 9, paths: { host: 'signed-host', receiver: 'receiver', state: 'state' } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  const controller = new AbortController();
  vi.mocked(estimateRequestBytes).mockImplementation(async () => { controller.abort(); throw new Error('cancelled'); });
  await expect(nativeClipExportProvider()?.({ ...request, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(createMacClipExporter).not.toHaveBeenCalled();
});

it('stops when a source changes during metadata inspection', async () => {
  vi.mocked(resolveVerifiedNativeResources).mockResolvedValue({ revision: 9, paths: { host: 'signed-host', receiver: 'receiver', state: 'state' } });
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  const { NativeExportSourceChanged } = await import('./nativeExportBudget');
  vi.mocked(estimateRequestBytes).mockRejectedValue(new NativeExportSourceChanged());
  await expect(nativeClipExportProvider()?.(request)).rejects.toMatchObject({ name: 'NativeExportSourceChanged' });
  expect(createMacClipExporter).not.toHaveBeenCalled();
});

it('does not start a large candidate with a host missing held publication', async () => {
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2');
  expect(await nativeClipExportProvider()?.(request)).toEqual({ status: 'fallback', reason: 'native-unavailable' });
  expect(createMacClipExporter).not.toHaveBeenCalled();
});
it('keeps the existing bounded encoder route on a non-clone volume before native generation', async () => {
  vi.mocked(detectNativeExportCapability).mockResolvedValue('budget-v2-held');
  vi.mocked(estimateRequestBytes).mockResolvedValue({ bytes: 17_350_000_000, sourceRevision: 'fingerprint' });
  vi.mocked(supportsHeldPublicationVolume).mockResolvedValue(false);
  expect(await nativeClipExportProvider()?.(request)).toEqual({ status: 'fallback', reason: 'native-unavailable' });
  expect(createMacClipExporter).not.toHaveBeenCalled();
  expect(createExportResources).not.toHaveBeenCalled();
});
