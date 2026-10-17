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
    settle: (actualTime?: number) => {
      if (actualTime !== undefined) time = actualTime;
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

it('does not repeatedly seek a paused target that the decoder clamps to its first frame', () => {
  const player = fixture();
  player.advance(5);
  renderHook(() => useMediaTimeSync(player.ref, true, 0, false));
  for (let index = 0; index < 10; index++) {
    act(() => player.settle(5));
    act(() => player.listeners.get('canplay')?.());
  }
  expect(player.seek.mock.calls).toEqual([[0]]);
});

it('allows a new paused request after visiting an already settled time or reloading', () => {
  const player = fixture();
  player.advance(5);
  const { rerender } = renderHook(
    ({ time, ready }) => useMediaTimeSync(player.ref, ready, time, false),
    { initialProps: { time: 0, ready: true } },
  );
  act(() => player.settle(5));
  rerender({ time: 5, ready: true });
  rerender({ time: 0, ready: true });
  expect(player.seek.mock.calls).toEqual([[0], [0]]);
  act(() => player.settle(5));
  rerender({ time: 0, ready: false });
  rerender({ time: 0, ready: true });
  expect(player.seek.mock.calls).toEqual([[0], [0], [0]]);
});

it('corrects tolerated playback drift precisely when pausing at the same target', () => {
  const player = fixture();
  const { rerender } = renderHook(
    ({ playing }) => useMediaTimeSync(player.ref, true, 5, playing),
    { initialProps: { playing: true } },
  );
  act(() => player.settle(5.1));
  expect(player.seek.mock.calls).toEqual([[5]]);
  rerender({ playing: false });
  expect(player.seek.mock.calls).toEqual([[5], [5]]);
});

it('retries an explicit paused seek without restarting a seeked loop', () => {
  const player = fixture();
  player.advance(5);
  renderHook(() => useMediaTimeSync(player.ref, true, 0, false));
  act(() => player.settle(5));
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  act(() => player.listeners.get('canplay')?.());
  act(() => player.settle(5));
  expect(player.seek.mock.calls).toEqual([[0], [0]]);
});

it('restores a successfully settled paused target after a source resets its clock', () => {
  const player = fixture();
  renderHook(() => useMediaTimeSync(player.ref, true, 1.5, false));
  act(player.settle);
  // Video.js can restore the source start after the initial seek has completed.
  act(() => player.settle(0));
  expect(player.seek.mock.calls).toEqual([[1.5], [1.5]]);
});

it('replaces an explicit seek whose old target was evicted by the capture buffer', () => {
  const player = fixture();
  const { rerender } = renderHook(
    ({ time }) => useMediaTimeSync(player.ref, true, time, false),
    { initialProps: { time: 1 } },
  );
  // No seeked event can arrive for the old target after its buffer was removed.
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  rerender({ time: 60 });
  expect(player.seek.mock.calls).toEqual([[1], [60]]);
  act(player.settle);
  expect(player.seek).toHaveBeenCalledTimes(2);
});
