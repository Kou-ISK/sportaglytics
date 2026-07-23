import { describe, expect, it } from 'vitest';
import { materializePackageAngle } from './packageMediaCompositionService';

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
