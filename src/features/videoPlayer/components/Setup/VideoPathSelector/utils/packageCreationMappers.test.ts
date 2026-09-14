import { describe, expect, it } from 'vitest';
import type { PackageDatas } from '../../../../../../renderer';
import { buildPackageLoadResult } from './packageCreationMappers';

const createdPackage = (
  packagePath: string,
  separator: string,
): PackageDatas => ({
  timelinePath: `${packagePath}${separator}timeline.json`,
  metaDataConfigFilePath: `${packagePath}${separator}.metadata${separator}config.json`,
  tightViewPath: `${packagePath}/videos/first.MP4`,
  wideViewPath: null,
  angles: [
    {
      id: 'main',
      name: 'Main',
      sourceKind: 'local',
      absolutePath: `${packagePath}/videos/first.MP4`,
      clips: [
        {
          id: 'first',
          sourceKind: 'local',
          relativePath: 'videos/first.MP4',
          gapBeforeSeconds: 0,
          timelineStartSeconds: 0,
          durationSeconds: 10,
        },
        {
          id: 'second',
          sourceKind: 'local',
          relativePath: 'videos/後半 #50%.mp4',
          gapBeforeSeconds: 2,
          timelineStartSeconds: 12,
          durationSeconds: 8,
        },
      ],
    },
    {
      id: 'youtube',
      name: 'Broadcast',
      sourceKind: 'youtube',
      absolutePath: 'https://youtu.be/example',
      clips: [
        {
          id: 'remote',
          sourceKind: 'youtube',
          sourceUrl: 'https://youtu.be/example',
          gapBeforeSeconds: 0,
        },
      ],
    },
  ],
});

describe('created package paths', () => {
  it.each([
    ['/matches/試合 #50%.stpkg', '/'],
    ['C:\\Matches\\試合 #50%.stpkg', '\\'],
    ['\\\\server\\matches\\試合 #50%.stpkg', '\\'],
  ])(
    'resolves every clip under the returned package: %s',
    (packagePath, separator) => {
      const result = buildPackageLoadResult(
        createdPackage(packagePath, separator),
      );
      expect(result.packagePath).toBe(packagePath);
      expect(result.videoList[0]).toBe(`${packagePath}/videos/first.MP4`);
      expect(result.mediaAngles?.[0].clips.map((clip) => clip.source)).toEqual([
        `${packagePath}/videos/first.MP4`,
        `${packagePath}/videos/後半 #50%.mp4`,
      ]);
      expect(result.mediaAngles?.[0].clips[1]).toMatchObject({
        timelineStartSeconds: 12,
        durationSeconds: 8,
        gapBeforeSeconds: 2,
      });
      expect(result.mediaAngles?.[1].clips[0].source).toBe(
        'https://youtu.be/example',
      );
    },
  );

  it('rejects an invalid creation location instead of guessing one', () => {
    const created = createdPackage('/matches/match.stpkg', '/');
    created.metaDataConfigFilePath = '/wrong/config.json';
    expect(() => buildPackageLoadResult(created)).toThrow(
      '保存先を確認できません',
    );
  });
});
