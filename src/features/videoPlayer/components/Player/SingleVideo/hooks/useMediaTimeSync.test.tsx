/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useMediaTimeSync } from './useMediaTimeSync';
import { claimNativePlayback } from '../../../../shared/nativePlayback/playbackAuthority';

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

it('ignores a captured HTML seek completion while native owns the clock', () => {
  const player = fixture();
  const hook = renderHook(
    ({ time }) => useMediaTimeSync(player.ref, true, time, false),
    { initialProps: { time: 1 } },
  );
  const oldCanPlay = player.listeners.get('canplay');
  let release!: () => void;
  act(() => {
    release = claimNativePlayback();
  });
  hook.rerender({ time: 4 });
  act(() => {
    player.settle();
    oldCanPlay?.();
  });
  expect(player.seek.mock.calls).toEqual([[1]]);
  hook.unmount();
  act(() => release());
});

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

it('coalesces real seek-start events while a complete local file is already decoding', () => {
  const player = fixture();
  const ref = {
    current: {
      ...player.ref.current,
      currentSrc: () => 'file:///synthetic.mp4',
      duration: () => 100,
      seekable: () => ({ length: 1, start: () => 0, end: () => 100 }),
    },
  };
  const hook = renderHook(
    ({ time }) => useMediaTimeSync(ref, true, time, false),
    { initialProps: { time: 1 } },
  );
  for (const time of [2, 3, 4]) {
    act(() => window.dispatchEvent(new Event('video-seek-start')));
    hook.rerender({ time });
  }
  expect(player.seek.mock.calls).toEqual([[1]]);
  act(player.settle);
  expect(player.seek.mock.calls).toEqual([[1], [4]]);
  act(player.settle);
  expect(player.seek).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it('still replaces an evicted seek even when the current source has a finite local URL', () => {
  const player = fixture();
  const ref = {
    current: {
      ...player.ref.current,
      currentSrc: () => 'file:///synthetic.mp4',
      duration: () => 100,
      seekable: () => ({ length: 1, start: () => 50, end: () => 100 }),
    },
  };
  const hook = renderHook(
    ({ time }) => useMediaTimeSync(ref, true, time, false),
    { initialProps: { time: 1 } },
  );
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  hook.rerender({ time: 60 });
  expect(player.seek.mock.calls).toEqual([[1], [60]]);
  hook.unmount();
});

it('keeps a queued explicit seek precise during playback', () => {
  const player = fixture();
  const ref = {
    current: {
      ...player.ref.current,
      currentSrc: () => 'file:///synthetic.mp4',
      duration: () => 100,
      seekable: () => ({ length: 1, start: () => 0, end: () => 100 }),
    },
  };
  const hook = renderHook(
    ({ time }) => useMediaTimeSync(ref, true, time, true),
    { initialProps: { time: 1 } },
  );
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  hook.rerender({ time: 1.1 });
  expect(player.seek.mock.calls).toEqual([[1]]);
  act(player.settle);
  expect(player.seek.mock.calls).toEqual([[1], [1.1]]);
  hook.unmount();
});

it('does not let a queued local seek block a source reload or gap reentry', () => {
  const player = fixture();
  const ref = {
    current: {
      ...player.ref.current,
      currentSrc: () => 'file:///synthetic.mp4',
      duration: () => 100,
      seekable: () => ({ length: 1, start: () => 0, end: () => 100 }),
    },
  };
  const initialProps: { time: number | undefined } = { time: 1 };
  const hook = renderHook(
    ({ time }) => useMediaTimeSync(ref, true, time, false),
    { initialProps },
  );
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  hook.rerender({ time: 2 });
  act(() => player.listeners.get('loadeddata')?.());
  expect(player.seek.mock.calls).toEqual([[1], [2]]);
  act(() => window.dispatchEvent(new Event('video-seek-start')));
  hook.rerender({ time: 3 });
  hook.rerender({ time: undefined });
  hook.rerender({ time: 4 });
  expect(player.seek.mock.calls).toEqual([[1], [2], [4]]);
  hook.unmount();
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

it('does not seek inside a gap and replaces an unfinished seek on reentry', () => {
  const player = fixture();
  const initialProps: { time: number | undefined } = { time: 1 };
  const { rerender } = renderHook(
    ({ time }: { time: number | undefined }) =>
      useMediaTimeSync(player.ref, true, time, true),
    { initialProps },
  );
  // The old seek cannot settle after its data is evicted.
  rerender({ time: undefined });
  act(() => player.listeners.get('canplay')?.());
  expect(player.seek.mock.calls).toEqual([[1]]);
  rerender({ time: 4 });
  expect(player.seek.mock.calls).toEqual([[1], [4]]);
  act(player.settle);
  expect(player.seek).toHaveBeenCalledTimes(2);
});
