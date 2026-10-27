import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPackageDirectory, pickPackagePath } from './packageGateway';

afterEach(() => vi.unstubAllGlobals());

it('rejects obsolete preparation before bind and scopes cleanup after a later same-path bind', async () => {
  let finishPrepare: (value: {
    status: string;
    packagePath: string;
  }) => void = () => undefined;
  const delayed = new Promise<{ status: string; packagePath: string }>(
    (resolve) => {
      finishPrepare = resolve;
    },
  );
  const bind = vi.fn(async (_path: string, _id?: string) => true);
  const release = vi.fn(async () => true);
  const prepare = vi
    .fn(async (packagePath: string) => ({ status: 'ready', packagePath }))
    .mockReturnValueOnce(delayed);
  vi.stubGlobal('window', {
    electronAPI: {
      preparePackageForOpen: prepare,
      bindPackageSession: bind,
      releasePackageSession: release,
      checkFileExists: async () => true,
      readJsonFile: async () => ({
        angles: [
          {
            id: 'main',
            name: 'Main',
            sourceKind: 'local',
            relativePath: 'videos/one.mp4',
          },
        ],
      }),
    },
  });
  let current = true;
  const old = loadPackageDirectory('/sample.stpkg', 'old', () => current);
  const rejected = expect(old).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  current = false;
  finishPrepare({ status: 'ready', packagePath: '/sample.stpkg' });
  await rejected;
  expect(bind).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledWith('/sample.stpkg', 'old');

  let finishRead: (value: unknown) => void = () => undefined;
  const read = new Promise<unknown>((resolve) => {
    finishRead = resolve;
  });
  const api = window.electronAPI;
  // This transport models Main's request-scoped release; the real registry has a separate same-path regression.
  let owner = '';
  bind.mockImplementation(async (_path?: string, id?: string) => {
    owner = id ?? '';
    return true;
  });
  release.mockImplementation(async (_path?: string, id?: string) => {
    if (owner !== id) return false;
    owner = '';
    return true;
  });
  const readJson = vi.fn<() => Promise<unknown>>(async () => ({
    angles: [
      {
        id: 'main',
        name: 'Main',
        sourceKind: 'local',
        relativePath: 'videos/one.mp4',
      },
    ],
  }));
  vi.stubGlobal('window', {
    electronAPI: { ...api, readJsonFile: readJson.mockReturnValueOnce(read) },
  });
  const first = loadPackageDirectory('/sample.stpkg', 'first');
  const firstRejected = expect(first).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await vi.waitFor(() => expect(readJson).toHaveBeenCalled());
  await loadPackageDirectory('/sample.stpkg', 'second');
  finishRead({
    angles: [
      {
        id: 'main',
        name: 'Main',
        sourceKind: 'local',
        relativePath: 'videos/one.mp4',
      },
    ],
  });
  await firstRejected;
  expect(release).toHaveBeenLastCalledWith('/sample.stpkg', 'first');
  expect(owner).toBe('second');
});

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

  it('passes a missing original unchanged to Main so journal recovery precedes history suffix fallback', async () => {
    const api = installApi(['/matches/old.stpkg']);
    const selected = await pickPackagePath('/matches/old');
    expect(selected).toBe('/matches/old');
    await loadPackageDirectory(selected!);
    expect(api.preparePackageForOpen).toHaveBeenCalledWith(
      '/matches/old',
      expect.any(String),
    );
  });

  it('preserves an existing original path even when a sibling also exists', async () => {
    const api = installApi(['/matches/original', '/matches/original.stpkg']);
    const selectedPath = await pickPackagePath('/matches/original');
    expect(selectedPath).toBe('/matches/original');
    await loadPackageDirectory(selectedPath!);
    expect(api.preparePackageForOpen).toHaveBeenCalledWith(
      '/matches/original',
      expect.any(String),
    );
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
    expect(api.preparePackageForOpen).toHaveBeenCalledWith(
      '/matches/missing',
      expect.any(String),
    );
    expect(api.bindPackageSession).not.toHaveBeenCalled();
  });
});

it('releases the prepared destination if reading fails, so another window can retry', async () => {
  const release = vi.fn(async () => undefined);
  const bind = vi.fn(async (_path: string, _id?: string) => true);
  vi.stubGlobal('window', {
    electronAPI: {
      preparePackageForOpen: async () => ({
        status: 'ready',
        packagePath: '/copies/converted.stpkg',
      }),
      bindPackageSession: bind,
      releasePackageSession: release,
      checkFileExists: async () => true,
      readJsonFile: async () => {
        throw new Error('read failed');
      },
    },
  });
  await expect(loadPackageDirectory('/original')).rejects.toThrow(
    'read failed',
  );
  expect(bind).toHaveBeenCalledWith(
    '/copies/converted.stpkg',
    expect.any(String),
  );
  expect(release).toHaveBeenCalledWith(
    '/copies/converted.stpkg',
    expect.any(String),
  );
  expect(release).toHaveBeenCalledWith('/original', expect.any(String));
  bind.mockResolvedValue(false);
  release.mockClear();
  await expect(loadPackageDirectory('/original')).rejects.toThrow(
    '別のウィンドウ',
  );
  expect(release).toHaveBeenCalledTimes(2);
  const id = bind.mock.calls.at(-1)?.[1];
  expect(typeof id).toBe('string');
  expect(release).toHaveBeenCalledWith('/original', id);
});

it('uses one generated ID from preparation through failed binding and reservation release', async () => {
  const prepare = vi.fn(async (_path: string, _id?: string) => ({
    status: 'ready',
    packagePath: '/native.stpkg',
  }));
  const bind = vi.fn(async (_path: string, _id?: string) => false);
  const release = vi.fn(async (_path: string, _id?: string) => true);
  vi.stubGlobal('window', {
    electronAPI: {
      preparePackageForOpen: prepare,
      bindPackageSession: bind,
      releasePackageSession: release,
    },
  });
  await expect(loadPackageDirectory('/native.stpkg')).rejects.toThrow(
    '別のウィンドウ',
  );
  const id = prepare.mock.calls[0][1];
  expect(typeof id).toBe('string');
  expect(bind).toHaveBeenCalledExactlyOnceWith('/native.stpkg', id);
  expect(release).toHaveBeenCalledExactlyOnceWith('/native.stpkg', id);
});
