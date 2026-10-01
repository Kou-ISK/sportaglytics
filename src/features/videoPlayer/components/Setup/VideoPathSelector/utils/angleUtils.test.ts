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
    expect(result.angles[3].playbackOffsetSeconds).toBe(-2);
  });

  it.each([
    ['/tmp/copy.stpkg', '/tmp/outside #%.mp4', '/tmp/outside #%.mp4'],
    ['C:\\copy.stpkg', 'D:\\outside #%.mp4', 'D:/outside #%.mp4'],
    [
      'C:\\copy.stpkg',
      '\\\\server\\share\\outside #%.mp4',
      '//server/share/outside #%.mp4',
    ],
    [
      '/tmp/copy.stpkg',
      'file:///tmp/outside%20%23%25.mp4',
      '/tmp/outside #%.mp4',
    ],
    [
      'C:\\copy.stpkg',
      'videos\\inside #%.mp4',
      'C:/copy.stpkg/videos/inside #%.mp4',
    ],
  ])(
    'resolves external or relative media without prefixing absolute paths: %s %s',
    (packagePath, reference, expected) => {
      const result = buildVideoListFromConfig(
        {
          angles: [
            {
              id: 'a',
              name: 'Main',
              relativePath: reference,
              clips: [
                {
                  id: 'c',
                  relativePath: reference,
                  gapBeforeSeconds: 0,
                  durationSeconds: 3,
                },
              ],
            },
          ],
        },
        packagePath,
      );
      expect(result.videoList).toEqual([expected]);
      expect(result.angles[0].clips[0].source).toBe(expected);
    },
  );

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

  it('uses the actual package directory when main adds the extension', () => {
    const result = buildPackageLoadResult({
      timelinePath: '/chosen/match.stpkg/timeline.json',
      tightViewPath: '',
      wideViewPath: null,
      angles: [],
      metaDataConfigFilePath: '/chosen/match.stpkg/.metadata/config.json',
    });

    expect(result.packagePath).toBe('/chosen/match.stpkg');
  });
});
