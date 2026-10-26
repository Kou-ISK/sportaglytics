import { afterEach, expect, it, vi } from 'vitest';
import { nativePlaybackProvider } from './nativePlaybackStartup';
vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/synthetic/profile' },
}));
vi.mock('./runtime/nativeResources', () => ({
  resolveNativeResources: vi.fn(),
}));
vi.mock('./runtime/nativeRuntime', () => ({
  createNativePlaybackRuntime: vi.fn(),
}));
afterEach(() => vi.unstubAllEnvs());
it.skipIf(process.platform !== 'darwin' || process.arch !== 'arm64')(
  'enables packaged qualification without a preview environment switch',
  () => {
    vi.stubEnv('SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW', undefined);
    expect(typeof nativePlaybackProvider('/synthetic/build')).toBe('function');
    vi.stubEnv('SPORTAGLYTICS_NATIVE_PLAYBACK_PREVIEW', '0');
    expect(typeof nativePlaybackProvider('/synthetic/build')).toBe('function');
  },
);
