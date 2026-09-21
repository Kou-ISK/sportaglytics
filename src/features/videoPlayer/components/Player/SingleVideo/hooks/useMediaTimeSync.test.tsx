/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useMediaTimeSync } from './useMediaTimeSync';

const fixture = () => {
  let time = 0;
  let seeking = false;
  const listeners = new Map<string, () => void>();
  const seek = vi.fn();
  const ref = {
    current: {
      currentTime: (value?: number): number => {
        if (value !== undefined) {
          seek(value);
          time = value;
          seeking = true;
        }
        return time;
      },
      seeking: () => seeking,
      on: (event: string, listener: () => void) =>
        listeners.set(event, listener),
      off: (event: string) => listeners.delete(event),
    },
  };
  return {
    ref,
    seek,
    listeners,
    settle: () => {
      seeking = false;
      listeners.get('seeked')?.();
    },
    advance: (value: number) => {
      time = value;
    },
  };
};

it('finishes a paused drag at the latest target without interrupting each decode', () => {
  const player = fixture();
  const { rerender, unmount } = renderHook(
    ({ time }) => useMediaTimeSync(player.ref, true, time, false),
    { initialProps: { time: 1 } },
  );
  rerender({ time: 2 });
  rerender({ time: 3 });
  expect(player.seek.mock.calls).toEqual([[1]]);
  act(player.settle);
  expect(player.seek.mock.calls).toEqual([[1], [3]]);
  unmount();
  expect(player.listeners.size).toBe(0);
});

it('lets native 6x playback advance and applies an explicit seek precisely', () => {
  const player = fixture();
  const { rerender } = renderHook(
    ({ time, playing }) => useMediaTimeSync(player.ref, true, time, playing, 6),
    { initialProps: { time: 0, playing: true } },
  );
  for (let index = 1; index <= 60; index++) {
    player.advance(index * 0.1 - 0.3);
    rerender({ time: index * 0.1, playing: true });
  }
  expect(player.seek).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  rerender({ time: 8, playing: true });
  expect(player.seek).toHaveBeenLastCalledWith(8);
  // Key release pauses at the latest package time after the pending seek completes.
  rerender({ time: 8.1, playing: false });
  act(player.settle);
  expect(player.seek).toHaveBeenLastCalledWith(8.1);
});

it('restores the requested frame if decoding resets an initial seek', () => {
  const player = fixture();
  renderHook(() => useMediaTimeSync(player.ref, true, 5, false));
  act(player.settle);
  player.advance(0);
  act(() => player.listeners.get('loadeddata')?.());
  expect(player.seek.mock.calls).toEqual([[5], [5]]);
});
