import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyClipTimeline } from './packageClipTimelineService';

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

describe('applyClipTimeline', () => {
  it('saves a manual YouTube placement when duration is unavailable', async () => {
    const rootPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-clip-timeline-'),
    );
    temporaryPaths.push(rootPath);
    const packagePath = path.join(rootPath, 'youtube.stpkg');
    const metadataPath = path.join(packagePath, '.metadata');
    const configPath = path.join(metadataPath, 'config.json');
    await fs.mkdir(metadataPath, { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        angles: [
          {
            id: 'youtube-angle',
            name: 'YouTube',
            sourceKind: 'youtube',
            sourceUrl: 'https://www.youtube.com/watch?v=example',
            clips: [
              {
                id: 'youtube-clip',
                sourceKind: 'youtube',
                sourceUrl: 'https://www.youtube.com/watch?v=example',
                gapBeforeSeconds: 0,
              },
            ],
          },
        ],
      }),
    );

    const result = await applyClipTimeline(configPath, [
      { clipId: 'youtube-clip', timelineStartSeconds: 12 },
    ]);
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));

    expect(saved.angles[0].clips[0].timelineStartSeconds).toBe(12);
    expect(saved.angles[0].clips[0].durationSeconds).toBeUndefined();
    expect(result.angles[0].clips[0].timelineStartSeconds).toBe(12);
  });
});
