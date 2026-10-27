// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { app } from 'electron';
import { resolveNativeResources } from '../nativePlayback/runtime/nativeResources';
import { createMacClipExporter } from './macClipExporter';
import { nativeClipExportProvider } from './nativeClipExportStartup';
import type { NativeClipExportResult } from './nativeClipExport';

const state = vi.hoisted(() => ({
  onQuit: undefined as (() => void) | undefined,
}));
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: () => '/test-state',
    once: (_event: string, fn: () => void) => {
      state.onQuit = fn;
    },
  },
}));
vi.mock('../nativePlayback/runtime/nativeResources', () => ({
  resolveNativeResources: vi.fn(),
}));
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
  vi.mocked(resolveNativeResources).mockResolvedValue({
    host: 'signed-host',
    receiver: 'receiver',
    state: 'state',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});
it('does not enable unsigned development or other platforms', () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
  expect(nativeClipExportProvider()).toBeUndefined();
  expect(resolveNativeResources).not.toHaveBeenCalled();
});
it('falls back when fixed signed resources cannot be verified', async () => {
  vi.mocked(resolveNativeResources).mockRejectedValue(
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
  expect(resolveNativeResources).toHaveBeenCalledOnce();
});
it('propagates app shutdown and forbids later fallback or publication work', async () => {
  let active: AbortSignal | undefined;
  vi.mocked(createMacClipExporter).mockReturnValue(async (value) => {
    active = value.signal;
    return { status: 'completed' };
  });
  const provider = nativeClipExportProvider();
  await provider?.(request);
  state.onQuit?.();
  expect(active?.aborted).toBe(true);
  await expect(provider?.(request)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(app.isPackaged).toBe(true);
});
