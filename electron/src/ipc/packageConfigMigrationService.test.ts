import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { convertConfigToRelativePath } from './packageConfigMigrationService';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((temporaryPath) =>
        fs.rm(temporaryPath, { recursive: true, force: true }),
      ),
  );
});

describe('convertConfigToRelativePath', () => {
  it('migrates legacy angle playback pointers to immutable source clips', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-package-migration-'),
    );
    temporaryPaths.push(rootPath);
    const packagePath = path.join(rootPath, 'legacy.stpkg');
    const metadataPath = path.join(packagePath, '.metadata');
    const sourcePath = path.join(
      packagePath,
      'videos',
      'sources',
      'angle-1',
      '01-source.mp4',
    );
    const legacyPlaybackPath = path.join(
      packagePath,
      'videos',
      'Legacy Angle 1.mp4',
    );
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.mkdir(metadataPath, { recursive: true });
    await fs.writeFile(sourcePath, 'source');
    await fs.writeFile(legacyPlaybackPath, 'source');
    await fs.writeFile(
      path.join(metadataPath, 'config.json'),
      JSON.stringify({
        tightViewPath: 'videos/Legacy Angle 1.mp4',
        primaryAngleId: 'angle-1',
        angles: [
          {
            id: 'angle-1',
            name: 'Angle 1',
            sourceKind: 'local',
            relativePath: 'videos/Legacy Angle 1.mp4',
            clips: [
              {
                id: 'clip-1',
                sourceKind: 'local',
                relativePath: 'videos/sources/angle-1/01-source.mp4',
                gapBeforeSeconds: 0,
                timelineStartSeconds: 0,
                durationSeconds: 1,
              },
            ],
          },
        ],
      }),
    );

    const result = await convertConfigToRelativePath(packagePath);
    const saved = JSON.parse(
      await fs.readFile(path.join(metadataPath, 'config.json'), 'utf8'),
    );

    expect(result.success).toBe(true);
    expect(saved.tightViewPath).toBe('videos/sources/angle-1/01-source.mp4');
    expect(saved.angles[0].relativePath).toBe(
      'videos/sources/angle-1/01-source.mp4',
    );
    await expect(fs.readFile(legacyPlaybackPath, 'utf8')).resolves.toBe(
      'source',
    );
  });

  it('preserves a YouTube primary angle while migrating local pointers', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-youtube-migration-'),
    );
    temporaryPaths.push(rootPath);
    const packagePath = path.join(rootPath, 'youtube.stpkg');
    const metadataPath = path.join(packagePath, '.metadata');
    const localSourcePath = path.join(
      packagePath,
      'videos',
      'sources',
      'local-angle',
      '01-source.mp4',
    );
    await fs.mkdir(path.dirname(localSourcePath), { recursive: true });
    await fs.mkdir(metadataPath, { recursive: true });
    await fs.writeFile(localSourcePath, 'source');
    await fs.writeFile(
      path.join(metadataPath, 'config.json'),
      JSON.stringify({
        tightViewPath: 'https://www.youtube.com/watch?v=example',
        wideViewPath: 'videos/Legacy Local.mp4',
        primaryAngleId: 'youtube-angle',
        secondaryAngleId: 'local-angle',
        angles: [
          {
            id: 'youtube-angle',
            sourceKind: 'youtube',
            sourceUrl: 'https://www.youtube.com/watch?v=example',
            clips: [],
          },
          {
            id: 'local-angle',
            sourceKind: 'local',
            relativePath: 'videos/Legacy Local.mp4',
            clips: [
              {
                id: 'local-clip',
                sourceKind: 'local',
                relativePath: 'videos/sources/local-angle/01-source.mp4',
              },
            ],
          },
        ],
      }),
    );

    await convertConfigToRelativePath(packagePath);
    const saved = JSON.parse(
      await fs.readFile(path.join(metadataPath, 'config.json'), 'utf8'),
    );

    expect(saved.tightViewPath).toBe('https://www.youtube.com/watch?v=example');
    expect(saved.wideViewPath).toBe('videos/sources/local-angle/01-source.mp4');
  });

  it('upgrades a tight/wide-only package to one clip per angle', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-tight-wide-migration-'),
    );
    temporaryPaths.push(rootPath);
    const packagePath = path.join(rootPath, 'oldest.stpkg');
    const metadataPath = path.join(packagePath, '.metadata');
    const videosPath = path.join(packagePath, 'videos');
    await fs.mkdir(metadataPath, { recursive: true });
    await fs.mkdir(videosPath, { recursive: true });
    await fs.writeFile(path.join(videosPath, 'tight.mp4'), 'tight');
    await fs.writeFile(path.join(videosPath, 'wide.mp4'), 'wide');
    await fs.writeFile(
      path.join(metadataPath, 'config.json'),
      JSON.stringify({
        tightViewPath: 'videos/tight.mp4',
        wideViewPath: 'videos/wide.mp4',
      }),
    );

    await convertConfigToRelativePath(packagePath);
    const saved = JSON.parse(
      await fs.readFile(path.join(metadataPath, 'config.json'), 'utf8'),
    );

    expect(saved.primaryAngleId).toBe('legacy-angle-1');
    expect(saved.secondaryAngleId).toBe('legacy-angle-2');
    expect(saved.angles).toHaveLength(2);
    expect(saved.angles[0].clips[0]).toMatchObject({
      sourceKind: 'local',
      relativePath: 'videos/tight.mp4',
      timelineStartSeconds: 0,
    });
  });
});
