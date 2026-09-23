import { beforeEach, describe, expect, it, vi } from 'vitest';
import { composeExportTimelineRange } from './exportTimelineComposition';
import { probeMedia } from './packageMediaCompositionService';
import { runFfmpegProcess } from './exportFfmpegProcess';

vi.mock('../mediaTools', () => ({
  getFfmpegPath: () => 'ffmpeg',
  H264_ENCODER_ARGS: [],
}));
vi.mock('./packageMediaCompositionService', () => ({ probeMedia: vi.fn() }));
vi.mock('./exportFfmpegProcess', () => ({
  runFfmpegProcess: vi.fn().mockResolvedValue(undefined),
  concatFfmpegFiles: vi.fn(),
}));
vi.mock('./exportStreamCopy', () => ({
  canConcatenateWithoutEncoding: vi.fn().mockResolvedValue(false),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(probeMedia).mockResolvedValue({
    durationSeconds: 2.04,
    width: 320,
    height: 180,
    hasAudio: true,
  });
});

describe('captured timeline export', () => {
  it('honors declared intervals despite AAC padding and probes only the requested range', async () => {
    const clips = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
      sourcePath: `segment-${index}.mp4`,
      timelineStartSeconds: index * 2,
      durationSeconds: 2,
    }));
    await composeExportTimelineRange(
      clips,
      0,
      { start: 15, end: 21 },
      'output.mp4',
      vi.fn(),
    );
    expect(vi.mocked(probeMedia).mock.calls.flat()).toEqual([
      'segment-0.mp4',
      'segment-7.mp4',
      'segment-8.mp4',
      'segment-9.mp4',
      'segment-10.mp4',
    ]);
    const args = vi.mocked(runFfmpegProcess).mock.calls[0][1];
    const durations = args.flatMap((value, index) =>
      value === '-t' ? [args[index + 1]] : [],
    );
    expect(durations).toEqual(['1', '2', '2', '1', '6']);
    expect(args[args.indexOf('-filter_complex') + 1]).toContain(
      'concat=n=4:v=1:a=1',
    );
  });

  it('continues to reject genuinely overlapping package intervals', async () => {
    await expect(
      composeExportTimelineRange(
        [
          {
            id: 'a',
            sourcePath: 'a.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 2.04,
          },
          {
            id: 'b',
            sourcePath: 'b.mp4',
            timelineStartSeconds: 2,
            durationSeconds: 2,
          },
        ],
        0,
        { start: 0, end: 4 },
        'output.mp4',
        vi.fn(),
      ),
    ).rejects.toThrow('CLIP_TIMELINE_OVERLAP');
    expect(runFfmpegProcess).not.toHaveBeenCalled();
  });
});
