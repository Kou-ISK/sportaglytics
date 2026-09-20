// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyClipTimeline } from './packageClipTimelineService';
vi.mock('./packageMediaCompositionService', () => ({ probeMedia: vi.fn() }));
describe('angle sync persistence', () => {
  it('saves offsets and segment positions together and leaves the file untouched on invalid offsets or overlaps', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'angle-sync-'));
    try {
      const file = path.join(temp, 'sample.stpkg', '.metadata', 'config.json');
      await fs.mkdir(path.dirname(file), { recursive: true });
      const angles = [0, 1].map((i) => ({
        id: `angle${i}`,
        name: `Angle ${i + 1}`,
        sourceKind: 'local',
        clips: [0, 1].map((j) => ({
          id: `${i}-${j}`,
          sourceKind: 'local',
          relativePath: `videos/${i}-${j}.mp4`,
          timelineStartSeconds: j * 6,
          durationSeconds: 6,
        })),
      }));
      await fs.writeFile(file, JSON.stringify({ angles }));
      await applyClipTimeline(
        file,
        [{ clipId: '1-1', timelineStartSeconds: 8 }],
        [0, 1],
      );
      const saved = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(saved);
      expect(parsed.syncData.angleOffsets).toEqual([0, 1]);
      expect(parsed.angles[1].clips[1].timelineStartSeconds).toBe(8);
      await expect(
        applyClipTimeline(
          file,
          [{ clipId: '1-1', timelineStartSeconds: 5 }],
          [0, 2],
        ),
      ).rejects.toThrow('OVERLAP');
      expect(await fs.readFile(file, 'utf8')).toBe(saved);
      await expect(applyClipTimeline(file, [], [0, NaN])).rejects.toThrow(
        'INVALID_ANGLE_OFFSETS',
      );
      expect(await fs.readFile(file, 'utf8')).toBe(saved);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
