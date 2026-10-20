// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { getVideoJsPlayer } from '../../shared/videojs/videoJsAdapter';
import { isPackageMediaBuffering } from './packagePlaybackReadiness';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const angles: PackageMediaAngle[] = [
  {
    id: 'one',
    name: 'One',
    sourceKind: 'local',
    clips: [
      {
        id: 'clip',
        sourceKind: 'local',
        source: 'media/clip.mp4',
        timelineStartSeconds: 10,
        durationSeconds: 20,
        gapBeforeSeconds: 10,
      },
    ],
  },
];
const fixture = () => {
  const root = document.createElement('div');
  const video = document.createElement('video');
  root.append(video);
  vi.mocked(getVideoJsPlayer).mockReturnValue({ el: () => root });
  return (
    readyState: number,
    seeking = false,
    ended = false,
    failed = false,
  ): void => {
    Object.defineProperties(video, {
      readyState: { configurable: true, value: readyState },
      seeking: { configurable: true, value: seeking },
      ended: { configurable: true, value: ended },
      error: { configurable: true, value: failed ? { code: 3 } : null },
    });
  };
};
it('waits for active native media with no future data or an unfinished seek', () => {
  const update = fixture();
  for (const ready of [0, 1, 2]) {
    update(ready);
    expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(true);
  }
  update(4, true);
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(true);
  update(3);
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(false);
});
it('does not turn a terminal media error into an endless buffering hold', () => {
  fixture()(0, false, false, true);
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(false);
});
it('keeps gaps and ended frames advancing so clip boundaries remain reachable', () => {
  const update = fixture();
  update(0);
  for (const time of [0, 9.9, 30, 40]) {
    expect(isPackageMediaBuffering(angles, undefined, time)).toBe(false);
  }
  update(2, false, true);
  expect(isPackageMediaBuffering(angles, undefined, 29.99)).toBe(false);
});
it('respects secondary angle placement and sync offsets', () => {
  fixture()(1);
  const sync = { isAnalyzed: true, syncOffset: 5 };
  const pair = [{ ...angles[0], clips: [] }, angles[0]];
  expect(isPackageMediaBuffering(pair, sync, 6)).toBe(true);
  expect(isPackageMediaBuffering(pair, sync, 26)).toBe(false);
});
it('leaves non-native players on their existing clock path', () => {
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(false);
  vi.mocked(getVideoJsPlayer).mockReturnValue({
    el: () => document.createElement('div'),
  });
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(false);
});
