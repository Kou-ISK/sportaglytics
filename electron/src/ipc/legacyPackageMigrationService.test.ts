import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
      instances: [{ id: 'instance-1', actionName: 'Scrum' }],
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
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((temporaryPath) =>
        fs.rm(temporaryPath, { recursive: true, force: true }),
      ),
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
    expect(result.packagePath).toBe(`${sourcePath}.stpkg`);
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
      fs.readFile(path.join(result.packagePath, 'videos', 'match.mp4'), 'utf-8'),
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
    expect(result.packagePath).toBe(`${sourcePath}-2.stpkg`);
    await expect(fs.readFile(`${sourcePath}.stpkg/unrelated.txt`, 'utf-8')).resolves.toBe(
      'keep',
    );
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

    const result = await preparePackageForOpen(packagePath);

    expect(result).toEqual({
      status: 'ready',
      packagePath,
      migrated: false,
      reused: false,
    });
  });
});
