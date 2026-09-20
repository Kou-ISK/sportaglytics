// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAngleSyncPreviewClock } from './useAngleSyncPreviewClock';

const fixture = () => {
  let time = 0;
  const events = new Map<string, Set<() => void>>();
  const player = {
    currentTime: vi.fn((seconds?: number): number => {
      if (seconds !== undefined) time = seconds;
      return time;
    }),
    isDisposed: () => false,
    paused: () => true,
    readyState: vi.fn(() => 4),
    pause: vi.fn(),
    on: (event: string, listener: () => void): void => {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event)?.add(listener);
    },
    off: (event: string, listener: () => void): void => {
      events.get(event)?.delete(listener);
    },
  };
  return {
    player,
    params: {
      playerRef: { current: player },
      source: 'A.mp4',
      time: 2 as number | null,
      ready: true,
      waitForDecodedFrame: true,
      playing: false,
      suspended: false,
      error: '',
      play: vi.fn(),
    },
    resetSource: () => {
      time = 0;
    },
    emit: (event: string) =>
      events.get(event)?.forEach((listener) => listener()),
  };
};
it('reapplies the latest requested frame when source readiness resets the media clock after render', () => {
  const f = fixture();
  const { rerender, unmount } = renderHook(useAngleSyncPreviewClock, {
    initialProps: f.params,
  });
  expect(f.player.currentTime()).toBe(2);
  rerender({ ...f.params, source: 'B.mp4', time: 3 });
  f.resetSource(); // Windows decoded the replacement source after the React update.
  f.emit('loadeddata');
  expect(f.player.currentTime()).toBe(3);
  f.resetSource();
  f.emit('canplay');
  expect(f.player.currentTime()).toBe(3);
  rerender({ ...f.params, source: 'B.mp4', time: 4 });
  f.resetSource();
  f.emit('seeked');
  expect(f.player.currentTime()).toBe(4);
  unmount();
  f.resetSource();
  f.emit('canplay');
  expect(f.player.currentTime()).toBe(0);
});
it('waits for a decoded frame after a source switch and then seeks the latest requested time', () => {
  const f = fixture();
  f.player.readyState.mockReturnValue(1);
  const { rerender, unmount } = renderHook(useAngleSyncPreviewClock, {
    initialProps: f.params,
  });
  f.emit('loadedmetadata');
  expect(f.player.currentTime()).toBe(0);
  rerender({ ...f.params, time: 3 });
  expect(f.player.currentTime()).toBe(0);
  f.player.readyState.mockReturnValue(2);
  f.emit('loadeddata');
  expect(f.player.currentTime()).toBe(3);
  unmount();
});
it('uses the YouTube readiness contract without waiting for an HTML video frame', () => {
  const f = fixture();
  f.player.readyState.mockReturnValue(0);
  const { unmount } = renderHook(useAngleSyncPreviewClock, {
    initialProps: { ...f.params, waitForDecodedFrame: false },
  });
  expect(f.player.currentTime()).toBe(2);
  unmount();
});
it('does not seek into a gap or interfere with audio analysis and defers unready media', () => {
  const f = fixture();
  const { rerender, unmount } = renderHook(useAngleSyncPreviewClock, {
    initialProps: { ...f.params, ready: false },
  });
  f.emit('loadeddata');
  expect(f.player.currentTime()).toBe(0);
  rerender({ ...f.params, ready: true });
  expect(f.player.currentTime()).toBe(2);
  rerender({ ...f.params, ready: true, time: null });
  f.resetSource();
  f.emit('canplay');
  expect(f.player.currentTime()).toBe(0);
  expect(f.player.pause).toHaveBeenCalled();
  rerender({ ...f.params, ready: true, suspended: true });
  f.emit('seeked');
  expect(f.player.currentTime()).toBe(0);
  unmount();
});
