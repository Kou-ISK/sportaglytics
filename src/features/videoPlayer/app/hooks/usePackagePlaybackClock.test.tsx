// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';

afterEach(() => vi.unstubAllGlobals());
it('holds at the captured edge, resumes when media arrives, and honors manual pause', () => {
  let callback: FrameRequestCallback = () => {};
  const request = vi.fn((next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const setCurrentTime = vi.fn();
  const setIsVideoPlaying = vi.fn();
  const mediaAngles: PackageMediaAngle[] = [
    {
      id: 'one',
      name: 'One',
      sourceKind: 'local',
      clips: [
        {
          id: 'clip',
          sourceKind: 'local',
          source: 'media/clip.mp4',
          timelineStartSeconds: 0,
          durationSeconds: 20,
          gapBeforeSeconds: 0,
        },
      ],
    },
  ];
  const params = {
    mediaAngles,
    syncMode: 'auto' as const,
    isVideoPlaying: true,
    videoPlayBackRate: 1,
    currentTime: 3,
    setCurrentTime,
    setIsVideoPlaying,
    setMaxSec: vi.fn(),
    livePlaybackEnd: 4,
  };
  const hook = renderHook((props) => usePackagePlaybackClock(props), {
    initialProps: params,
  });
  act(() => {
    callback(0);
    callback(2000);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(3.9);
  expect(setIsVideoPlaying).not.toHaveBeenCalled();
  hook.rerender({ ...params, currentTime: 3.9, livePlaybackEnd: 8 });
  act(() => {
    callback(3000);
    callback(4000);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(5.9);
  request.mockClear();
  hook.rerender({
    ...params,
    currentTime: 4.9,
    livePlaybackEnd: 8,
    isVideoPlaying: false,
  });
  expect(cancel).toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it('keeps elapsed time across delayed renders but applies an explicit seek and pause', () => {
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    frame = next;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const setCurrentTime = vi.fn();
  const params = {
    mediaAngles: [
      {
        id: 'one',
        name: 'One',
        sourceKind: 'local' as const,
        clips: [
          {
            id: 'clip',
            sourceKind: 'local' as const,
            source: 'media/clip.mp4',
            timelineStartSeconds: 0,
            durationSeconds: 60,
            gapBeforeSeconds: 0,
          },
        ],
      },
    ],
    syncMode: 'auto' as const,
    isVideoPlaying: true,
    videoPlayBackRate: 1,
    currentTime: 3,
    setCurrentTime,
    setIsVideoPlaying: vi.fn(),
    setMaxSec: vi.fn(),
  };
  const hook = renderHook((props) => usePackagePlaybackClock(props), {
    initialProps: params,
  });
  act(() => {
    frame(0);
    frame(200);
    frame(400);
  });
  // The 3.2-second render commits after the clock has already reached 3.4.
  hook.rerender({ ...params, currentTime: 3.2 });
  act(() => frame(600));
  expect(setCurrentTime.mock.lastCall?.[0]).toBeCloseTo(3.6);
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', { detail: { time: -2 } }),
    );
    frame(700);
  });
  expect(setCurrentTime.mock.lastCall?.[0]).toBeCloseTo(-1.9);
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', { detail: { time: 20 } }),
    );
    frame(800);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(20.1);
  hook.rerender({ ...params, currentTime: 9, isVideoPlaying: false });
  hook.rerender({ ...params, currentTime: 9, isVideoPlaying: true });
  act(() => {
    frame(1000);
    frame(1200);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(9.2);
  hook.unmount();
});
