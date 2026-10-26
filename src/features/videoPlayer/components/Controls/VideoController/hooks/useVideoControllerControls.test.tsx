// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NativePlaybackController } from '../../../../shared/nativePlayback/nativePlaybackController';
import { bindNativePlayback } from '../../../../shared/nativePlayback/nativePlaybackRegistry';
import { useVideoControllerControls } from './useVideoControllerControls';

const make = (onSeek?: (time: number) => void) => {
  const currentTime = vi.fn(() => 2);
  const handleCurrentTime = vi.fn(
    (_event: React.SyntheticEvent | Event, time: number | number[]) => {
      if (typeof time === 'number') onSeek?.(time);
    },
  );
  const setVideoTime = vi.fn();
  const hook = renderHook(() =>
    useVideoControllerControls({
      setVideoPlayBackRate: vi.fn(),
      triggerFlash: vi.fn(),
      setIsVideoPlaying: vi.fn(),
      maxSec: 100,
      videoTime: 4,
      setVideoTime,
      handleCurrentTime,
      getExistingPlayer: () => ({ currentTime }),
      lastManualSeekTimestamp: { current: 0 },
    }),
  );
  return { ...hook, currentTime, handleCurrentTime, setVideoTime };
};
afterEach(() => vi.useRealTimers());
it('uses the HTML clock when it owns playback', () => {
  const hook = make();
  hook.result.current.onSeekAdjust(10);
  expect(hook.handleCurrentTime).toHaveBeenCalledWith(expect.any(Event), 12);
  expect(hook.result.current.speedOptions).toContain(6);
  hook.unmount();
});
it('uses the pending native command instead of stale HTML time without changing the confirmed clock', async () => {
  vi.useFakeTimers();
  const owner = { generation: 'toolbar', sourceKey: 'a'.repeat(64) };
  let unbind = () => {};
  const controller = new NativePlaybackController(
    {
      inspect: vi.fn(),
      open: vi.fn(async () => {}),
      apply: vi.fn(async () => {}),
      onSnapshot: vi.fn(() => () => {}),
      observe: vi.fn(async () => ({
        intent: null,
        observation: null,
        lastConfirmedTime: 40,
        error: null,
        closing: false,
        closed: false,
      })),
      close: async () => ({
        generation: owner.generation,
        nativeDrained: true,
        processStarted: true,
        processExited: true,
        pipesClosed: true,
        stopped: null,
      }),
    },
    owner,
    'file:///synthetic.mp4',
    40,
    { playing: false, rate: 1, audioTrack: 0, volume: 1, muted: true },
    { pause: vi.fn(), restore: async () => {}, release: () => unbind() },
  );
  unbind = bindNativePlayback(controller);
  const hook = make();
  try {
    await vi.advanceTimersByTimeAsync(1);
    controller.seek(70);
    hook.result.current.onSeekAdjust(10);
    expect(hook.handleCurrentTime).toHaveBeenLastCalledWith(
      expect.any(Event),
      80,
    );
    hook.result.current.onSeekAdjust(-30);
    expect(hook.handleCurrentTime).toHaveBeenLastCalledWith(
      expect.any(Event),
      40,
    );
    expect(hook.currentTime).not.toHaveBeenCalled();
  } finally {
    await controller.returnToOriginal();
    hook.unmount();
  }
});

it('accumulates repeated relative seeks while native readiness is pending, matching the original player', async () => {
  vi.useFakeTimers();
  const owner = { generation: 'relative', sourceKey: 'b'.repeat(64) };
  const controller = new NativePlaybackController(
    {
      inspect: vi.fn(),
      open: vi.fn(async () => {}),
      apply: vi.fn(async () => {}),
      observe: vi.fn(async () => ({
        intent: null,
        observation: null,
        lastConfirmedTime: 40,
        error: null,
        closing: false,
        closed: false,
      })),
      onSnapshot: vi.fn(() => () => {}),
      close: async () => ({
        generation: owner.generation,
        nativeDrained: true,
        processStarted: false,
        processExited: true,
        pipesClosed: true,
        stopped: null,
      }),
    },
    owner,
    'file:///synthetic.mp4',
    40,
    { playing: false, rate: 1, audioTrack: 0, volume: 1, muted: true },
    { pause: vi.fn(), restore: async () => {}, release: () => unbind() },
  );
  const unbind = bindNativePlayback(controller);
  const hook = make((time) => controller.seek(time));
  try {
    await vi.advanceTimersByTimeAsync(1);
    hook.result.current.onSeekAdjust(10);
    hook.result.current.onSeekAdjust(10);
    expect(hook.handleCurrentTime.mock.calls.map((call) => call[1])).toEqual([
      50, 60,
    ]);
    // Desired position must not become a confirmed tag/save/playback clock.
    expect(controller.snapshot().time).toBe(40);
    hook.result.current.onSeekAdjust(-30);
    expect(hook.handleCurrentTime).toHaveBeenLastCalledWith(
      expect.any(Event),
      30,
    );
  } finally {
    await controller.returnToOriginal();
    hook.unmount();
  }
});
