// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { usePackagePlaybackClock } from './usePackagePlaybackClock';
import {
  isPackageMediaBuffering,
  demandPackagePlaybackRanges,
} from './packagePlaybackReadiness';

vi.mock('./packagePlaybackReadiness', () => ({
  isPackageMediaBuffering: vi.fn(() => false),
  demandPackagePlaybackRanges: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(demandPackagePlaybackRanges).mockClear();
  vi.mocked(isPackageMediaBuffering).mockReturnValue(false);
});
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
  vi.mocked(demandPackagePlaybackRanges).mockClear();
  hook.rerender({ ...params, currentTime: 3.2 });
  expect(demandPackagePlaybackRanges).not.toHaveBeenCalled();
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
  expect(demandPackagePlaybackRanges).toHaveBeenLastCalledWith(
    params.mediaAngles,
    undefined,
    20,
    true,
  );
  vi.mocked(demandPackagePlaybackRanges).mockClear();
  hook.rerender({ ...params, currentTime: 3.6 });
  expect(demandPackagePlaybackRanges).not.toHaveBeenCalled();
  hook.rerender({ ...params, currentTime: 9, isVideoPlaying: false });
  expect(demandPackagePlaybackRanges).toHaveBeenLastCalledWith(
    params.mediaAngles,
    undefined,
    9,
    true,
  );
  hook.rerender({ ...params, currentTime: 9, isVideoPlaying: true });
  act(() => {
    frame(1000);
    frame(1200);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(9.2);
  hook.unmount();
});

it('holds the clock through decode waits and seeks without catching up on recovery', () => {
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    frame = next;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const setCurrentTime = vi.fn();
  const hook = renderHook(() =>
    usePackagePlaybackClock({
      mediaAngles: [
        {
          id: 'one',
          name: 'One',
          sourceKind: 'local',
          clips: [
            {
              id: 'clip',
              sourceKind: 'local',
              source: 'media/long.mp4',
              timelineStartSeconds: 0,
              durationSeconds: 9000,
              gapBeforeSeconds: 0,
            },
          ],
        },
      ],
      syncMode: 'auto',
      isVideoPlaying: true,
      videoPlayBackRate: 1,
      currentTime: 4500,
      setCurrentTime,
      setIsVideoPlaying: vi.fn(),
      setMaxSec: vi.fn(),
    }),
  );
  act(() => {
    frame(0);
    frame(100);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(4500.1);
  vi.mocked(isPackageMediaBuffering).mockReturnValue(true);
  setCurrentTime.mockClear();
  act(() => {
    frame(200);
    frame(2200);
  });
  expect(setCurrentTime).not.toHaveBeenCalled();
  expect(hook.result.current.holdPlayback).toBe(true);
  vi.mocked(isPackageMediaBuffering).mockReturnValue(false);
  act(() => {
    frame(2300);
    frame(2400);
  });
  expect(setCurrentTime.mock.lastCall?.[0]).toBeCloseTo(4500.2);
  expect(hook.result.current.holdPlayback).toBe(false);
  vi.mocked(isPackageMediaBuffering).mockReturnValue(true);
  act(() => {
    window.dispatchEvent(
      new CustomEvent('video-seek-start', { detail: { time: 7000 } }),
    );
    frame(2500);
    frame(4500);
  });
  vi.mocked(isPackageMediaBuffering).mockReturnValue(false);
  act(() => {
    frame(4600);
    frame(4700);
  });
  expect(setCurrentTime).toHaveBeenLastCalledWith(7000.1);
  hook.unmount();
});
