import { describe, expect, it, vi } from 'vitest';
import type { ExportClipsPayload } from './exportHandlers.types';
import {
  buildExportPreparationJobs,
  prepareExportSources,
} from './exportSourcePreparation';
import { materializeExportSource } from './exportVirtualTimelineSource';
vi.mock('./exportVirtualTimelineSource', () => ({
  materializeExportSource: vi.fn(),
}));

describe('export source preparation', () => {
  it('bounds each used source to its own requested intervals and counts preparation work', async () => {
    const payload: ExportClipsPayload = {
      sourcePath: 'first.mp4',
      clips: [
        { id: 'one', actionName: 'Review', startTime: 3500, endTime: 3502 },
        {
          id: 'two',
          actionName: 'Review',
          startTime: 10,
          endTime: 12,
          videoSource: 'second.mp4',
        },
      ],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showMemo: false,
        showLabels: false,
      },
    };
    const jobs = buildExportPreparationJobs(payload, [
      {
        sourcePath: 'first.mp4',
        clips: [
          {
            id: 'a',
            sourcePath: 'original-a.mp4',
            durationSeconds: 3600,
            timelineStartSeconds: 0,
          },
        ],
      },
      {
        sourcePath: 'second.mp4',
        clips: [
          {
            id: 'b',
            sourcePath: 'original-b.mp4',
            durationSeconds: 3600,
            timelineStartSeconds: 20,
          },
        ],
      },
    ]);
    expect(jobs.map(({ range, weight }) => ({ range, weight }))).toEqual([
      { range: { start: 3500, end: 3502 }, weight: 0 },
      { range: { start: 10, end: 12 }, weight: 2 },
    ]);
    vi.mocked(materializeExportSource).mockImplementation(
      async (plan, _temps, range, progress) => {
        progress(0.5);
        return {
          sourcePath: `${plan.sourcePath}.prepared`,
          timeOrigin: range.start,
        };
      },
    );
    const stage = vi.fn();
    const complete = vi.fn();
    const result = await prepareExportSources(jobs, [], stage, complete);
    expect(stage).toHaveBeenCalledWith(
      0.5,
      2,
      expect.stringContaining('2 / 2'),
    );
    expect(complete).toHaveBeenCalledWith(2, expect.any(String));
    expect(result.timeOrigins.get('second.mp4.prepared')).toBe(10);
  });
});
