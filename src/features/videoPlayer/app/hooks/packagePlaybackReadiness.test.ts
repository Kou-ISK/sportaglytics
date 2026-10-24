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

it('keeps the MSE append clock advancing through gaps but still waits for file fallbacks', () => {
  const root = document.createElement('div');
  const video = document.createElement('video');
  root.append(video);
  vi.mocked(getVideoJsPlayer).mockReturnValue({ el: () => root });
  const capture: PackageMediaAngle = {
    ...angles[0],
    playbackFormat: 'fragmented-mp4',
  };
  Object.defineProperties(video, {
    currentSrc: { configurable: true, value: 'blob:recording' },
    readyState: { configurable: true, value: 1 },
    seeking: { configurable: true, value: true },
  });
  expect(isPackageMediaBuffering([capture], undefined, 15)).toBe(false);
  // currentSrc is empty until the just-assigned MSE source is selected.
  video.src = 'blob:recording';
  Object.defineProperty(video, 'currentSrc', {
    configurable: true,
    value: '',
  });
  expect(isPackageMediaBuffering([capture], undefined, 15)).toBe(false);
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 2 },
    seeking: { configurable: true, value: false },
  });
  expect(isPackageMediaBuffering([capture], undefined, 15)).toBe(false);
  Object.defineProperty(video, 'currentSrc', {
    configurable: true,
    value: 'file:///recording.mp4',
  });
  expect(isPackageMediaBuffering([capture], undefined, 15)).toBe(true);
});

it('still holds every peer when a regular file buffers beside MSE', () => {
  const roots = [document.createElement('div'), document.createElement('div')];
  for (const [index, root] of roots.entries()) {
    const video = document.createElement('video');
    root.append(video);
    Object.defineProperties(video, {
      currentSrc: { value: index ? 'file:///video.mp4' : 'blob:recording' },
      readyState: { value: 1 },
    });
  }
  vi.mocked(getVideoJsPlayer).mockImplementation((id) => ({
    el: () => roots[id === 'video_0' ? 0 : 1],
  }));
  expect(
    isPackageMediaBuffering(
      [{ ...angles[0], playbackFormat: 'fragmented-mp4' }, angles[0]],
      undefined,
      15,
    ),
  ).toBe(true);
});

it('range transport uses requested original time even on capture-marked angles and paused seeks', async () => {
  const { bindRangePlaybackClock } =
    await import('../../shared/playbackRanges/rangePlaybackRegistry');
  const { demandPackagePlaybackRanges } =
    await import('./packagePlaybackReadiness');
  const root = document.createElement('div'),
    video = document.createElement('video');
  root.append(video);
  video.src = 'blob:ranges';
  Object.defineProperty(video, 'readyState', { value: 4 });
  vi.mocked(getVideoJsPlayer).mockReturnValue({ el: () => root });
  const ranges = {
    failure: null,
    demand: vi.fn(),
    seek: vi.fn(),
    isReady: vi.fn(() => false),
  };
  const unbind = bindRangePlaybackClock(video, 'blob:ranges', ranges);
  const capture = { ...angles[0], playbackFormat: 'fragmented-mp4' as const };
  expect(isPackageMediaBuffering([capture], undefined, 15)).toBe(true);
  expect(ranges.demand).toHaveBeenLastCalledWith(5);
  demandPackagePlaybackRanges([capture], undefined, 17, true);
  expect(ranges.seek).toHaveBeenLastCalledWith(7);
  ranges.isReady.mockReturnValue(true);
  expect(isPackageMediaBuffering([capture], undefined, 17)).toBe(false);
  unbind();
});

it('holds a failed range transport until original-return changes the actual binding', async () => {
  const { bindRangePlaybackClock } =
    await import('../../shared/playbackRanges/rangePlaybackRegistry');
  const root = document.createElement('div'),
    video = document.createElement('video');
  root.append(video);
  video.src = 'blob:failed';
  Object.defineProperty(video, 'readyState', { value: 4 });
  vi.mocked(getVideoJsPlayer).mockReturnValue({ el: () => root });
  const unbind = bindRangePlaybackClock(video, 'blob:failed', {
    failure: Error('failed'),
    demand: vi.fn(),
    seek: vi.fn(),
    isReady: () => true,
  });
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(true);
  video.src = 'file:///original.mp4';
  expect(isPackageMediaBuffering(angles, undefined, 15)).toBe(false);
  unbind();
});
