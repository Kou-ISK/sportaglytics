import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preparePackageForOpen } from './legacyPackageMigrationService';

const temporaryPaths: string[] = [];

const createLegacyFixture = async (
  rootPath: string,
  name = 'legacy-match',
): Promise<string> => {
  const sourcePath = path.join(rootPath, name);
  const metadataPath = path.join(sourcePath, '.metadata');
  const videosPath = path.join(sourcePath, 'videos');
  await fs.mkdir(metadataPath, { recursive: true });
  await fs.mkdir(videosPath, { recursive: true });
  const videoPath = path.join(videosPath, 'match.mp4');
  await fs.writeFile(videoPath, 'video-bytes');
  await fs.writeFile(
    path.join(sourcePath, 'timeline.json'),
    JSON.stringify({
      version: 2,
      rows: [{ id: 'row-1', name: 'Scrum', color: '#123456' }],
      instances: [
        {
          id: 'instance-1',
          actionName: 'Scrum',
          startTime: 1,
          endTime: 2,
          memo: '架空ノート',
        },
      ],
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(metadataPath, 'config.json'),
    JSON.stringify({
      team1Name: 'Home',
      team2Name: 'Away',
      tightViewPath: videoPath,
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(metadataPath, 'legacy-code-window.json'),
    JSON.stringify({ id: 'cw-1', name: 'Match coding window' }),
    'utf-8',
  );
  return sourcePath;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((temporaryPath) =>
        fs.rm(temporaryPath, { recursive: true, force: true }),
      ),
  );
});

it.each([
  null,
  {},
  { version: 3, rows: [], instances: [] },
  {
    version: 2,
    rows: [],
    instances: [{ id: 'bad', actionName: 'Tag', startTime: 2, endTime: 1 }],
  },
])('rejects an incompatible timeline before copying: %j', async (document) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-invalid-format-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root, 'candidate.stpkg');
  const timeline = path.join(source, 'timeline.json');
  const original = JSON.stringify(document);
  await fs.writeFile(timeline, original);
  await expect(preparePackageForOpen(source)).rejects.toThrow();
  expect(await fs.readdir(root)).toEqual(['candidate.stpkg']);
  expect(await fs.readFile(timeline, 'utf8')).toBe(original);
});

it('migrates an old .stpkg, preserves all auxiliary files, and reuses only unchanged sources', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-roundtrip-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root, '日本語 🏉 #%.stpkg');
  const timelinePath = path.join(source, 'timeline.json');
  const originalTimeline = JSON.stringify([
    {
      id: 'tag',
      actionName: '攻撃',
      startTime: 1.125,
      endTime: 2.25,
      memo: '架空の長文 🏉',
      color: '#123456',
      labels: [
        { name: '成功', group: '結果' },
        { name: '成功', group: '種類' },
      ],
      actionType: 'Kick',
    },
  ]);
  await fs.writeFile(timelinePath, originalTimeline);
  const auxiliary = {
    'drawing.json': '{"drawing":[1,2,3]}',
    'Playlist.stpl': '{"order":[2,1]}',
    'history.json': '{"undo":[1]}',
  };
  for (const [file, bytes] of Object.entries(auxiliary))
    await fs.writeFile(path.join(source, '.metadata', file), bytes);
  const first = await preparePackageForOpen(source);
  if (first.status !== 'ready') throw new Error('Expected ready');
  expect(first.packagePath).toBe(
    await fs.realpath(path.join(root, '日本語 🏉 #%-migrated.stpkg')),
  );
  expect(await fs.readFile(timelinePath, 'utf8')).toBe(originalTimeline);
  for (const [file, bytes] of Object.entries(auxiliary))
    expect(
      await fs.readFile(
        path.join(first.packagePath, '.metadata', file),
        'utf8',
      ),
    ).toBe(bytes);
  const migrated = JSON.parse(
    await fs.readFile(path.join(first.packagePath, 'timeline.json'), 'utf8'),
  );
  expect(migrated.instances[0]).toMatchObject({
    id: 'tag',
    memo: '架空の長文 🏉',
    startTime: 1.125,
    endTime: 2.25,
  });
  expect(migrated.instances[0].labels).toContainEqual({
    name: '成功',
    group: '結果',
  });
  expect(migrated.instances[0].labels).toContainEqual({
    name: '成功',
    group: '種類',
  });
  expect(migrated.instances[0].labels).toContainEqual({
    name: 'Kick',
    group: 'Type',
  });
  expect((await preparePackageForOpen(source)).status).toBe('ready');
  expect(await preparePackageForOpen(first.packagePath)).toMatchObject({
    migrated: false,
  });
  await fs.writeFile(
    path.join(source, '.metadata/drawing.json'),
    '{"drawing":[4]}',
  );
  const changed = await preparePackageForOpen(source);
  if (changed.status !== 'ready') throw new Error('Expected ready');
  expect(changed.packagePath).not.toBe(first.packagePath);
});

it.each(['EACCES', 'ENOSPC', 'EIO'])(
  'keeps the original and removes a partially copied target: %s',
  async (code) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-interruption-'),
    );
    temporaryPaths.push(root);
    const source = await createLegacyFixture(root);
    const original = await fs.readFile(
      path.join(source, 'timeline.json'),
      'utf8',
    );
    vi.spyOn(fs, 'cp').mockImplementationOnce(async (_source, target) => {
      await fs.mkdir(String(target));
      await fs.writeFile(path.join(String(target), 'partial'), 'partial');
      throw Object.assign(new Error('synthetic interruption'), { code });
    });
    await expect(
      preparePackageForOpen(source, path.join(root, 'copy.stpkg')),
    ).rejects.toThrow('synthetic interruption');
    expect(await fs.readdir(root)).toEqual(['legacy-match']);
    expect(await fs.readFile(path.join(source, 'timeline.json'), 'utf8')).toBe(
      original,
    );
  },
);

it('rejects missing media and symlinks without silently choosing a same-named video', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-reference-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root);
  const file = path.join(source, 'videos/match.mp4');
  await fs.rm(file);
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_MEDIA_MISSING',
  );
  await fs.writeFile(path.join(root, 'external.mp4'), 'keep');
  await fs.symlink(path.join(root, 'external.mp4'), file);
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_MEDIA_REFERENCE_INVALID',
  );
  expect(await fs.readFile(path.join(root, 'external.mp4'), 'utf8')).toBe(
    'keep',
  );
});

describe('preparePackageForOpen', () => {
  it('copies a legacy folder to a sibling stpkg without mutating the source', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-legacy-package-'),
    );
    temporaryPaths.push(rootPath);
    const sourcePath = await createLegacyFixture(rootPath);
    const sourceConfigPath = path.join(sourcePath, '.metadata', 'config.json');
    const sourceTimelinePath = path.join(sourcePath, 'timeline.json');
    const originalConfig = await fs.readFile(sourceConfigPath, 'utf-8');
    const originalTimeline = await fs.readFile(sourceTimelinePath, 'utf-8');

    const result = await preparePackageForOpen(sourcePath);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result');
    expect(result.packagePath).toBe(await fs.realpath(`${sourcePath}.stpkg`));
    expect(result.migrated).toBe(true);
    expect(result.reused).toBe(false);
    await expect(fs.readFile(sourceConfigPath, 'utf-8')).resolves.toBe(
      originalConfig,
    );
    await expect(fs.readFile(sourceTimelinePath, 'utf-8')).resolves.toBe(
      originalTimeline,
    );
    await expect(
      fs.readFile(
        path.join(result.packagePath, '.metadata', 'legacy-code-window.json'),
        'utf-8',
      ),
    ).resolves.toContain('Match coding window');
    await expect(
      fs.readFile(
        path.join(result.packagePath, 'videos', 'match.mp4'),
        'utf-8',
      ),
    ).resolves.toBe('video-bytes');

    const migratedConfig = JSON.parse(
      await fs.readFile(
        path.join(result.packagePath, '.metadata', 'config.json'),
        'utf-8',
      ),
    );
    expect(migratedConfig.tightViewPath).toBe('videos/match.mp4');
    expect(migratedConfig.angles[0].clips[0].relativePath).toBe(
      'videos/match.mp4',
    );
  });

  it('reuses the same migrated stpkg when the unchanged source is opened again', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-legacy-reuse-'),
    );
    temporaryPaths.push(rootPath);
    const sourcePath = await createLegacyFixture(rootPath);

    const first = await preparePackageForOpen(sourcePath);
    const second = await preparePackageForOpen(sourcePath);

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status !== 'ready' || second.status !== 'ready') {
      throw new Error('Expected ready results');
    }
    expect(second.packagePath).toBe(first.packagePath);
    expect(second.reused).toBe(true);
    const entries = await fs.readdir(rootPath);
    expect(entries.filter((entry) => entry.endsWith('.stpkg'))).toEqual([
      'legacy-match.stpkg',
    ]);
  });

  it('uses a conflict-safe sibling name when the preferred stpkg is unrelated', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-legacy-conflict-'),
    );
    temporaryPaths.push(rootPath);
    const sourcePath = await createLegacyFixture(rootPath);
    await fs.mkdir(`${sourcePath}.stpkg`, { recursive: true });
    await fs.writeFile(`${sourcePath}.stpkg/unrelated.txt`, 'keep');

    const result = await preparePackageForOpen(sourcePath);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result');
    expect(result.packagePath).toBe(await fs.realpath(`${sourcePath}-2.stpkg`));
    await expect(
      fs.readFile(`${sourcePath}.stpkg/unrelated.txt`, 'utf-8'),
    ).resolves.toBe('keep');
  });

  it('supports an explicit safe destination without overwriting unrelated data', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-legacy-destination-'),
    );
    temporaryPaths.push(rootPath);
    const sourcePath = await createLegacyFixture(rootPath);
    const destinationBase = path.join(rootPath, 'Migrated Match');

    const result = await preparePackageForOpen(sourcePath, destinationBase);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result');
    expect(result.packagePath).toBe(`${destinationBase}.stpkg`);
    await expect(
      fs.readFile(path.join(result.packagePath, 'timeline.json'), 'utf-8'),
    ).resolves.toContain('instance-1');
  });

  it('rejects malformed legacy folders before creating a migration target', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-legacy-invalid-'),
    );
    temporaryPaths.push(rootPath);
    const sourcePath = path.join(rootPath, 'broken');
    await fs.mkdir(path.join(sourcePath, '.metadata'), { recursive: true });
    await fs.writeFile(
      path.join(sourcePath, '.metadata', 'config.json'),
      '{broken',
      'utf-8',
    );
    await fs.writeFile(path.join(sourcePath, 'timeline.json'), '{}', 'utf-8');

    await expect(preparePackageForOpen(sourcePath)).rejects.toBeTruthy();
    await expect(fs.access(`${sourcePath}.stpkg`)).rejects.toBeTruthy();
  });

  it('leaves an existing stpkg in place', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-current-package-'),
    );
    temporaryPaths.push(rootPath);
    const packagePath = await createLegacyFixture(rootPath, 'current.stpkg');

    const configPath = path.join(packagePath, '.metadata/config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        angles: [
          {
            id: 'main',
            name: 'Main',
            sourceKind: 'local',
            relativePath: 'videos/match.mp4',
            clips: [
              {
                id: 'clip',
                sourceKind: 'local',
                relativePath: 'videos/match.mp4',
                gapBeforeSeconds: 0,
              },
            ],
          },
        ],
      }),
    );
    const result = await preparePackageForOpen(packagePath);

    expect(result).toEqual({
      status: 'ready',
      packagePath,
      migrated: false,
      reused: false,
    });
  });
});

it('concurrent opens serialize and reuse the same completed migration', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-concurrent-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root);
  const opened = await Promise.all([
    preparePackageForOpen(source),
    preparePackageForOpen(source),
    preparePackageForOpen(source),
  ]);
  expect(opened.every((result) => result.status === 'ready')).toBe(true);
  expect(
    new Set(
      opened.map((result) =>
        result.status === 'ready' ? result.packagePath : '',
      ),
    ).size,
  ).toBe(1);
  expect(
    opened.filter((result) => result.status === 'ready' && result.reused),
  ).toHaveLength(2);
  expect(
    (await fs.readdir(root)).filter((name) => name.endsWith('.stpkg')),
  ).toHaveLength(1);
});
it('migrates legacy angle pointers with no clips once, preserving external references and URL identity', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-old-angles-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root, 'old.stpkg');
  const external = path.join(root, 'outside #%.mp4');
  await fs.writeFile(external, 'external');
  const config = {
    angles: [
      {
        id: 'a',
        name: 'External',
        sourceKind: 'local',
        relativePath: external,
        clips: [],
      },
      {
        id: 'b',
        name: 'Remote',
        sourceKind: 'youtube',
        sourceUrl: 'https://www.youtube.com/watch?v=synthetic',
        clips: [],
      },
    ],
    primaryAngleId: 'a',
    secondaryAngleId: 'b',
  };
  const original = JSON.stringify(config);
  await fs.writeFile(path.join(source, '.metadata/config.json'), original);
  const result = await preparePackageForOpen(source);
  if (result.status !== 'ready') throw new Error('Expected ready');
  const copied = JSON.parse(
    await fs.readFile(
      path.join(result.packagePath, '.metadata/config.json'),
      'utf8',
    ),
  );
  expect(copied.angles[0].clips[0].relativePath).toBe(external);
  expect(copied.angles[1].clips[0].sourceUrl).toBe(config.angles[1].sourceUrl);
  expect(await preparePackageForOpen(result.packagePath)).toMatchObject({
    migrated: false,
  });
  expect(
    await fs.readFile(path.join(source, '.metadata/config.json'), 'utf8'),
  ).toBe(original);
  expect(await fs.readFile(external, 'utf8')).toBe('external');
});
it('rejects future config versions and insufficient capacity before creating any copy', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-space-'));
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root);
  const configPath = path.join(source, '.metadata/config.json');
  const original = await fs.readFile(configPath, 'utf8');
  await fs.writeFile(
    configPath,
    JSON.stringify({ ...JSON.parse(original), packageFormatVersion: 99 }),
  );
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_VERSION_UNSUPPORTED',
  );
  await fs.writeFile(configPath, original);
  const actual = await fs.statfs(root, { bigint: true });
  vi.spyOn(fs, 'statfs').mockImplementationOnce(async () => ({
    ...actual,
    bavail: 0n,
  }));
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_MIGRATION_SPACE',
  );
  expect(await fs.readdir(root)).toEqual(['legacy-match']);
  expect(await fs.readFile(configPath, 'utf8')).toBe(original);
});
it('detects source changes during copying and removes the incomplete destination', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-changing-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root);
  const copy = fs.cp.bind(fs);
  vi.spyOn(fs, 'cp').mockImplementationOnce(async (from, to, options) => {
    await copy(from, to, options);
    await fs.writeFile(path.join(source, '.metadata/changed.json'), '{}');
  });
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_SOURCE_CHANGED',
  );
  expect(await fs.readdir(root)).toEqual(['legacy-match']);
});
it('does not reuse a migration whose media is now missing', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-copy-missing-'),
  );
  temporaryPaths.push(root);
  const source = await createLegacyFixture(root);
  const first = await preparePackageForOpen(source);
  if (first.status !== 'ready') throw new Error('Expected ready');
  await fs.unlink(path.join(first.packagePath, 'videos/match.mp4'));
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_MIGRATION_COPY_INVALID',
  );
});
