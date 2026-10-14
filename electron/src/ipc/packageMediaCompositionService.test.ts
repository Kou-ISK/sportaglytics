import { describe, expect, it, vi } from 'vitest';
import {
  materializePackageAngle,
  probeMedia,
} from './packageMediaCompositionService';
import { runMediaProcess } from './mediaProcessRunner';

vi.mock('./mediaProcessRunner', () => ({ runMediaProcess: vi.fn() }));
vi.mock('../mediaTools', () => ({
  getFfprobePath: () => '/synthetic-ffprobe',
}));

it.each([
  ['60000/1001', '60/1', { numerator: 60000, denominator: 1001 }],
  ['0/0', '25/1', { numerator: 25, denominator: 1 }],
  ['-25/1', '50/1', { numerator: 50, denominator: 1 }],
  ['Infinity', '1/0', { numerator: 30, denominator: 1 }],
])(
  'reads a usable frame rate from %s / %s',
  async (average, nominal, expected) => {
    vi.mocked(runMediaProcess).mockResolvedValue({
      stdout: JSON.stringify({
        format: { duration: '2' },
        streams: [
          {
            codec_type: 'video',
            width: 160,
            height: 90,
            avg_frame_rate: average,
            r_frame_rate: nominal,
          },
        ],
      }),
      stderr: '',
    });
    expect((await probeMedia('/synthetic.mp4')).frameRate).toEqual(expected);
  },
);

describe('materializePackageAngle', () => {
  it('keeps a YouTube angle remote without writing a local file', async () => {
    const result = await materializePackageAngle(
      {
        id: 'broadcast',
        name: 'Broadcast',
        clips: [
          {
            id: 'youtube-1',
            sourceKind: 'youtube',
            source: 'https://www.youtube.com/watch?v=example',
            gapBeforeSeconds: 0,
          },
        ],
      },
      0,
      'Match',
      '/unused',
    );

    expect(result.sourceKind).toBe('youtube');
    expect(result.absolutePath).toBe('https://www.youtube.com/watch?v=example');
    expect(result.relativePath).toBeUndefined();
  });

  it('keeps multiple YouTube clips ordered without downloading them', async () => {
    const result = await materializePackageAngle(
      {
        id: 'broadcast',
        name: 'Broadcast',
        clips: [
          {
            id: 'youtube-1',
            sourceKind: 'youtube',
            source: 'https://youtu.be/one',
            gapBeforeSeconds: 0,
          },
          {
            id: 'youtube-2',
            sourceKind: 'youtube',
            source: 'https://youtu.be/two',
            gapBeforeSeconds: 0,
          },
        ],
      },
      0,
      'Match',
      '/unused',
    );
    expect(result.clips.map((clip) => clip.sourceUrl)).toEqual([
      'https://youtu.be/one',
      'https://youtu.be/two',
    ]);
  });
});
