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
    expect(result.get(1)?.get('second.mp4')?.timeOrigin).toBe(10);
  });

  it('does not prepare the unselected interval between periods, even when ids repeat', () => {
    const payload: ExportClipsPayload = {
      sourcePath: 'package-primary.mp4',
      clips: [
        { id: 'same', actionName: 'Review', startTime: 20, endTime: 30 },
        { id: 'same', actionName: 'Review', startTime: 3620, endTime: 3630 },
      ],
      overlay: {
        enabled: true,
        showActionName: true,
        showActionIndex: false,
        showMemo: true,
        showLabels: false,
      },
    };
    const jobs = buildExportPreparationJobs(payload, [
      {
        sourcePath: payload.sourcePath,
        clips: [
          {
            id: 'first',
            sourcePath: 'first.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 1800,
          },
          {
            id: 'second',
            sourcePath: 'second.mp4',
            timelineStartSeconds: 3600,
            durationSeconds: 1800,
          },
        ],
      },
    ]);
    expect(
      jobs.map(({ range, weight, clipIndexes }) => ({
        range,
        weight,
        clipIndexes,
      })),
    ).toEqual([
      { range: { start: 20, end: 30 }, weight: 0, clipIndexes: [0] },
      { range: { start: 3620, end: 3630 }, weight: 0, clipIndexes: [1] },
    ]);
  });

  it('shares identical crossing ranges but retains each instance binding and selected gaps', async () => {
    const clip = { id: 'one', actionName: 'Review', startTime: 8, endTime: 14 };
    const payload: ExportClipsPayload = {
      sourcePath: 'primary.mp4',
      clips: [clip, { ...clip, id: 'two' }],
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
        sourcePath: payload.sourcePath,
        clips: [
          {
            id: 'first',
            sourcePath: 'first.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 10,
          },
          {
            id: 'second',
            sourcePath: 'second.mp4',
            timelineStartSeconds: 12,
            durationSeconds: 10,
          },
        ],
      },
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      range: { start: 8, end: 14 },
      weight: 6,
      clipIndexes: [0, 1],
    });
    vi.mocked(materializeExportSource).mockClear();
    vi.mocked(materializeExportSource).mockResolvedValue({
      sourcePath: 'prepared.mp4',
      timeOrigin: 8,
    });
    const result = await prepareExportSources(jobs, [], vi.fn(), vi.fn());
    expect(materializeExportSource).toHaveBeenCalledTimes(1);
    expect(result.get(0)?.get(payload.sourcePath)).toEqual(
      result.get(1)?.get(payload.sourcePath),
    );
  });
});
