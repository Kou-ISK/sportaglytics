// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import {
  bindRangePlaybackClock,
  getRangePlaybackClock,
} from './rangePlaybackRegistry';
const port = () => ({
  failure: null,
  demand: vi.fn(),
  seek: vi.fn(),
  isReady: vi.fn(() => true),
});
it('each video URL has a single owner; old cleanup cannot remove a new binding', () => {
  const video = document.createElement('video');
  video.src = 'blob:one';
  const first = port(),
    second = port();
  const unbind = bindRangePlaybackClock(video, 'blob:one', first);
  expect(getRangePlaybackClock(video)).toBe(first);
  expect(() => bindRangePlaybackClock(video, 'blob:one', second)).toThrow();
  video.src = 'file:///original.mp4';
  expect(getRangePlaybackClock(video)).toBeUndefined();
  unbind();
  video.src = 'blob:two';
  const clear = bindRangePlaybackClock(video, 'blob:two', second);
  unbind();
  expect(getRangePlaybackClock(video)).toBe(second);
  clear();
});
it('does not bind originals or leak one angle readiness to another', () => {
  const a = document.createElement('video'),
    b = document.createElement('video');
  a.src = b.src = 'blob:one';
  expect(() =>
    bindRangePlaybackClock(a, 'file:///source.mp4', port()),
  ).toThrow();
  const unbind = bindRangePlaybackClock(a, 'blob:one', port());
  expect(getRangePlaybackClock(b)).toBeUndefined();
  unbind();
});
