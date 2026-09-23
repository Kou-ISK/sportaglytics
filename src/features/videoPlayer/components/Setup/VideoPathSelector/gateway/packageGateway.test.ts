import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPackageDirectory, pickPackagePath } from './packageGateway';

afterEach(() => vi.unstubAllGlobals());

describe('legacy creation history recovery', () => {
  const installApi = (existingPaths: string[]) => {
    const api = {
      checkFileExists: vi.fn(
        async (value: string) =>
          existingPaths.includes(value) ||
          value.endsWith('/.metadata/config.json'),
      ),
      preparePackageForOpen: vi.fn(async (packagePath: string) => ({
        status: 'ready',
        packagePath,
      })),
      bindPackageSession: vi.fn(async () => true),
      convertConfigToRelativePath: vi.fn(async () => undefined),
      readJsonFile: vi.fn(async () => ({
        angles: [
          {
            id: 'main',
            name: 'Main',
            playbackFormat: 'fragmented-mp4',
            sourceKind: 'local',
            relativePath: 'videos/first.mp4',
            clips: [
              {
                id: 'first',
                sourceKind: 'local',
                relativePath: 'videos/first.mp4',
                gapBeforeSeconds: 0,
              },
            ],
          },
        ],
      })),
    };
    vi.stubGlobal('window', { electronAPI: api });
    return api;
  };

  it('opens the existing .stpkg when an old history entry omitted the suffix', async () => {
    const api = installApi(['/matches/試合 #50%.stpkg']);
    const selectedPath = await pickPackagePath('/matches/試合 #50%');
    expect(selectedPath).toBe('/matches/試合 #50%.stpkg');
    const loaded = await loadPackageDirectory(selectedPath!);
    expect(api.preparePackageForOpen).toHaveBeenCalledWith(
      '/matches/試合 #50%.stpkg',
    );
    expect(api.bindPackageSession).toHaveBeenCalledWith(
      '/matches/試合 #50%.stpkg',
    );
    expect(loaded.result.packagePath).toBe('/matches/試合 #50%.stpkg');
    expect(loaded.result.mediaAngles?.[0].playbackFormat).toBe(
      'fragmented-mp4',
    );
    expect(loaded.result.mediaAngles?.[0].clips[0].source).toBe(
      '/matches/試合 #50%.stpkg/videos/first.mp4',
    );
  });

  it('preserves an existing original path even when a sibling also exists', async () => {
    const api = installApi(['/matches/original', '/matches/original.stpkg']);
    const selectedPath = await pickPackagePath('/matches/original');
    expect(selectedPath).toBe('/matches/original');
    await loadPackageDirectory(selectedPath!);
    expect(api.preparePackageForOpen).toHaveBeenCalledWith('/matches/original');
  });

  it('does not invent a replacement when neither path exists', async () => {
    const api = installApi([]);
    api.preparePackageForOpen.mockRejectedValueOnce(
      new Error('missing package'),
    );
    const selectedPath = await pickPackagePath('/matches/missing');
    expect(selectedPath).toBe('/matches/missing');
    await expect(loadPackageDirectory(selectedPath!)).rejects.toThrow(
      'missing package',
    );
    expect(api.preparePackageForOpen).toHaveBeenCalledWith('/matches/missing');
    expect(api.bindPackageSession).not.toHaveBeenCalled();
  });
});
