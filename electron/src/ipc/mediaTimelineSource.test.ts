// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { readMediaTimeline } from './mediaTimelineSource';
import { planExportSource } from './exportVirtualTimelineSource';
vi.mock('./packageMediaCompositionService', () => ({
  probeMedia: vi.fn(async () => ({ durationSeconds: 6 })),
  recomposeLocalTimeline: vi.fn(),
}));
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});
const fixture = async (offset: number) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-timeline-test-'));
  directories.push(dir);
  const root = path.join(dir, 'sample.stpkg');
  await fs.mkdir(path.join(root, '.metadata'), { recursive: true });
  const configPath = path.join(root, '.metadata', 'config.json');
  const config = {
    syncData: {
      isAnalyzed: true,
      syncOffset: offset,
      angleOffsets: [0, offset],
    },
    angles: [
      {
        id: 'one',
        relativePath: 'A.mp4',
        clips: [
          {
            id: 'A',
            relativePath: 'A.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 6,
          },
        ],
      },
      {
        id: 'two',
        relativePath: 'C.mp4',
        clips: [
          {
            id: 'C',
            relativePath: 'C.mp4',
            timelineStartSeconds: 1,
            durationSeconds: 6,
          },
          {
            id: 'D',
            relativePath: 'D.mp4',
            timelineStartSeconds: 8,
            durationSeconds: 6,
          },
        ],
      },
    ],
  };
  await fs.writeFile(configPath, JSON.stringify(config));
  return { root, configPath, config };
};
describe('media timeline source', () => {
  it.each([2, -2])(
    'shares the current placements and %s offset between playback and export',
    async (offset) => {
      const { root } = await fixture(offset);
      const source = path.join(root, 'D.mp4');
      const timeline = await readMediaTimeline(source, true);
      const plan = await planExportSource(source);
      expect(timeline?.offsetSeconds).toBe(offset);
      expect(timeline?.clips.map((clip) => clip.timelineStartSeconds)).toEqual([
        1, 8,
      ]);
      expect(plan.offsetSeconds).toBe(offset);
      expect(plan.clips?.map((clip) => clip.timelineStartSeconds)).toEqual([
        1, 8,
      ]);
    },
  );
  it('rejects escaped sources and broken package metadata instead of falling back to the first clip', async () => {
    const { root, configPath, config } = await fixture(0);
    config.angles[1].clips[1].relativePath = '../outside.mp4';
    await fs.writeFile(configPath, JSON.stringify(config));
    await expect(readMediaTimeline(path.join(root, 'C.mp4'))).rejects.toThrow(
      'INVALID_PACKAGE_MEDIA_PATH',
    );
    await fs.writeFile(configPath, '{');
    await expect(planExportSource(path.join(root, 'C.mp4'))).rejects.toThrow();
  });
  it('includes a nonzero correction for an angle with only one clip', async () => {
    const { root, configPath, config } = await fixture(3);
    config.angles[1].clips = config.angles[1].clips.slice(0, 1);
    config.angles[1].clips[0].timelineStartSeconds = 0;
    await fs.writeFile(configPath, JSON.stringify(config));
    expect(await planExportSource(path.join(root, 'C.mp4'))).toMatchObject({
      offsetSeconds: 3,
      clips: [{ sourcePath: path.join(root, 'C.mp4') }],
    });
  });
});
