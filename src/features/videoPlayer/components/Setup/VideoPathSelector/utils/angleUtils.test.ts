import { describe, expect, it } from 'vitest';
import { buildVideoListFromConfig } from './angleUtils';
import {
  buildAnglePayloads,
  buildPackageLoadResult,
} from './packageCreationMappers';

describe('multi-angle package mapping', () => {
  it('loads every configured angle and keeps primary/secondary first', () => {
    const result = buildVideoListFromConfig(
      {
        primaryAngleId: 'main',
        secondaryAngleId: 'wide',
        angles: [
          {
            id: 'reverse',
            name: 'Reverse',
            relativePath: 'videos/reverse.mp4',
          },
          { id: 'wide', name: 'Wide', relativePath: 'videos/wide.mp4' },
          { id: 'main', name: 'Main', relativePath: 'videos/main.mp4' },
          {
            id: 'youtube',
            name: 'Broadcast',
            sourceKind: 'youtube',
            sourceUrl: 'https://www.youtube.com/watch?v=abc123',
            clips: [
              {
                id: 'broadcast-clip',
                sourceKind: 'youtube',
                sourceUrl: 'https://www.youtube.com/watch?v=abc123',
                gapBeforeSeconds: 2,
              },
            ],
          },
        ],
      },
      '/match.stpkg',
    );

    expect(result.videoList).toEqual([
      '/match.stpkg/videos/main.mp4',
      '/match.stpkg/videos/wide.mp4',
      '/match.stpkg/videos/reverse.mp4',
      'https://www.youtube.com/watch?v=abc123',
    ]);
    expect(result.angles[3].clips[0].timelineStartSeconds).toBe(2);
  });

  it('keeps ordered clips and their black-gap duration in the IPC payload', () => {
    const result = buildAnglePayloads({
      selectedDirectory: '/tmp',
      angles: [
        {
          id: 'main',
          name: 'Main',
          clips: [
            {
              id: 'first',
              sourceKind: 'local',
              source: '/tmp/first.mp4',
              gapBeforeSeconds: 0,
            },
            {
              id: 'second',
              sourceKind: 'local',
              source: '/tmp/second.mp4',
              gapBeforeSeconds: 4.5,
            },
          ],
        },
      ],
    });

    expect(result[0].clips).toHaveLength(2);
    expect(result[0].clips[1].gapBeforeSeconds).toBe(4.5);
  });

  it('uses the directory selected during the final create action', () => {
    const result = buildPackageLoadResult(
      {
        timelinePath: '/chosen/match.stpkg/timeline.json',
        tightViewPath: '',
        wideViewPath: null,
        angles: [],
        metaDataConfigFilePath: '/chosen/match.stpkg/.metadata/config.json',
      },
      '/chosen',
      { packageName: 'match.stpkg', team1Name: 'A', team2Name: 'B' },
    );

    expect(result.packagePath).toBe('/chosen/match.stpkg');
  });
});
