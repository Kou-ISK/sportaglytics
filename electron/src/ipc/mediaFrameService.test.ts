// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { run, stat } = vi.hoisted(() => ({ run: vi.fn(), stat: vi.fn() }));
vi.mock('node:fs/promises', () => ({ stat }));
vi.mock('../mediaTools', () => ({ getFfprobePath: () => 'ffprobe' }));
vi.mock('./mediaProcessRunner', () => ({ runMediaProcess: run }));
import { readMediaFrameWindow } from './mediaFrameService';
import * as path from 'node:path';
beforeEach(() => {
  run.mockReset();
  stat
    .mockReset()
    .mockResolvedValue({ isFile: () => true, size: 10, mtimeMs: 1 });
});
describe('frame timestamp windows', () => {
  it('preserves the browser media clock for nonzero source timestamps and retains variable frame intervals, caching concurrent reads', async () => {
    run.mockResolvedValueOnce({
      stdout: JSON.stringify({
        frames: [5, 5.04, 5.08, 5.1, 5.12].map((time) => ({
          best_effort_timestamp_time: String(time),
        })),
      }),
    });
    const source = path.resolve('synthetic-vfr.mp4');
    const [first, second] = await Promise.all([
      readMediaFrameWindow(source, 5.06),
      readMediaFrameWindow(source, 5.08),
    ]);
    expect(first).toBe(second);
    expect(first.times.map((time) => Math.round(time * 1000))).toEqual([
      5000, 5040, 5080, 5100, 5120,
    ]);
    expect(run.mock.calls[0][1]).toContain('2%10');
    expect(run).toHaveBeenCalledTimes(1);
    stat.mockResolvedValueOnce({ isFile: () => true, size: 10, mtimeMs: 2 });
    run.mockResolvedValueOnce({
      stdout: '{"frames":[{"best_effort_timestamp_time":"0"}]}',
    });
    await readMediaFrameWindow(source, 5.06);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('rejects URLs, relative paths, non-media inputs, and invalid times before probing', async () => {
    for (const [source, time] of [
      ['https://example.invalid/video.mp4', 0],
      ['relative.mp4', 0],
      [path.resolve('settings.json'), 0],
      [path.resolve('video.mp4'), NaN],
      [path.resolve('video.mp4'), -1],
    ] as const)
      await expect(readMediaFrameWindow(source, time)).rejects.toThrow(
        'INVALID_FRAME_REQUEST',
      );
    expect(run).not.toHaveBeenCalled();
  });
});
