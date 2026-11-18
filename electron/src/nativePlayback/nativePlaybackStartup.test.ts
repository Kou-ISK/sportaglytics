import { BrowserWindow } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { nativePlaybackProvider } from './nativePlaybackStartup';
import { resolveNativeResources, resolveSignedNativeGroupResources } from './runtime/nativeResources';
vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/synthetic/profile' },
  BrowserWindow: class {},
}));
vi.mock('./runtime/nativeResources', () => ({
  resolveNativeResources: vi.fn(),
  resolveSignedNativeGroupResources: vi.fn(),
}));
vi.mock('./nativeGroupSourceProvider', () => ({
  createNativeGroupSourceProvider: (runtime: () => Promise<unknown>) => async () => {
    await runtime(); return null;
  },
}));
vi.mock('./runtime/nativeRuntime', () => ({
  createNativePlaybackRuntime: vi.fn(),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it.skipIf(process.platform === 'darwin' && process.arch === 'arm64')(
  'leaves unsupported hosts on the existing player without resolving helpers',
  () => {
    expect(nativePlaybackProvider('/synthetic/build')).toBeNull();
    expect(resolveNativeResources).not.toHaveBeenCalled();
  },
);
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')(
  'enables packaged qualification without a preview environment switch',
  () => {
    vi.stubEnv('SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW', undefined);
    expect(typeof nativePlaybackProvider('/synthetic/build')).toBe('function');
    vi.stubEnv('SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW', '0');
    expect(typeof nativePlaybackProvider('/synthetic/build')).toBe('function');
  },
);

it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')(
  'routes explicit group selection only through signed resources and its own capability signal', async () => {
    const provider = nativePlaybackProvider('/synthetic/build'); if (!provider) throw Error('provider');
    vi.mocked(resolveSignedNativeGroupResources).mockRejectedValueOnce(Error('unqualified helper'));
    // Startup routing alone is under test; the injected group boundary forwards its resource failure.
    const window = new BrowserWindow({ show: false }); // Constructor is mocked; no native window.
    await expect(provider(window,
      { angleIds: ['first', 'second'], audioAngleId: 'first' })).rejects.toThrow('unqualified helper');
    expect(resolveSignedNativeGroupResources).toHaveBeenCalledOnce();
    expect(resolveNativeResources).not.toHaveBeenCalled();
    const signal = vi.mocked(resolveSignedNativeGroupResources).mock.calls[0][2];
    expect(signal).toBeInstanceOf(AbortSignal); expect(signal.aborted).toBe(false);
  },
);
