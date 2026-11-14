// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateReversePlaybackTime,
  useContinuousReversePlayback,
} from './useContinuousReversePlayback';

describe('calculateReversePlaybackTime', () => {
  it('moves backward at the requested rate and clamps to the lower bound', () => {
    expect(calculateReversePlaybackTime(10, 2, 0.05, 0)).toBeCloseTo(9.9);
    expect(calculateReversePlaybackTime(0.1, 6, 0.05, 0)).toBe(0);
  });

  it('caps a delayed animation frame so focus stalls do not cause a large jump', () => {
    expect(calculateReversePlaybackTime(10, 6, 5, 0)).toBeCloseTo(9.4);
  });
});

describe('useContinuousReversePlayback', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    callbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const runNextFrame = (timestamp: number): void => {
    const entry = callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error('Expected a pending animation frame');
    callbacks.delete(entry[0]);
    entry[1](timestamp);
  };

  it('seeks backward continuously while held and stops on release', () => {
    const onPause = vi.fn();
    const onSeek = vi.fn();
    const { result } = renderHook(() =>
      useContinuousReversePlayback({ currentTime: 10, onPause, onSeek }),
    );

    act(() => result.current.startReversePlayback(2));
    act(() => runNextFrame(1000));
    act(() => runNextFrame(1050));

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(9.9, expect.any(AbortSignal));

    act(() => result.current.stopReversePlayback());
    expect(callbacks.size).toBe(0);
  });

  it('stops automatically at a playlist clip start', () => {
    const onSeek = vi.fn();
    const { result } = renderHook(() =>
      useContinuousReversePlayback({
        currentTime: 5.05,
        minimumTime: 5,
        onPause: vi.fn(),
        onSeek,
      }),
    );

    act(() => result.current.startReversePlayback(6));
    act(() => runNextFrame(1000));
    act(() => runNextFrame(1050));

    expect(onSeek).toHaveBeenLastCalledWith(5, expect.any(AbortSignal));
    expect(callbacks.size).toBe(0);
  });
});

describe('release with a pending presentation', () => {
  it('drops the unissued target while allowing the in-flight image to complete', async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.set(++next, cb);
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const tick = (time: number): void => {
      const entry = frames.entries().next().value as [
        number,
        FrameRequestCallback,
      ];
      frames.delete(entry[0]);
      entry[1](time);
    };
    let complete = (): void => {};
    const onSeek = vi.fn(
      (_time: number, _signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const hook = renderHook(() =>
      useContinuousReversePlayback({
        currentTime: 10,
        onPause: vi.fn(),
        onSeek,
      }),
    );
    act(() => {
      hook.result.current.startReversePlayback(2);
      tick(1000);
      tick(1050);
      tick(1100);
    });
    expect(onSeek).toHaveBeenCalledTimes(1);
    const signal = onSeek.mock.calls[0][1];
    act(() => hook.result.current.stopReversePlayback(true));
    expect(signal.aborted).toBe(false);
    await act(async () => {
      complete();
      await Promise.resolve();
    });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReverseSettled()).toBe(true);
    hook.unmount();
    vi.unstubAllGlobals();
  });
});

it('restarts from the image-confirmed time after a released in-flight seek settles', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const [key, cb] = frames.entries().next().value as [
      number,
      FrameRequestCallback,
    ];
    frames.delete(key);
    cb(t);
  };
  let finish = (_time: number): void => {};
  const seek = vi.fn(
    (_time: number, _signal: AbortSignal) =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(
    ({ time }) =>
      useContinuousReversePlayback({
        currentTime: time,
        onPause: vi.fn(),
        onSeek: seek,
      }),
    { initialProps: { time: 10 } },
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    tick(1100);
    tick(1150);
    hook.result.current.stopReversePlayback(true);
  });
  // The confirmed-clock update may arrive before the pending promise settles.
  hook.rerender({ time: 9.9 });
  await act(async () => {
    finish(9.9);
    await Promise.resolve();
  });
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(2000);
    tick(2050);
  });
  expect(seek.mock.calls[1][0]).toBeCloseTo(9.8);
  hook.unmount();
  vi.unstubAllGlobals();
});

it('does not issue a new gesture before the previous image is confirmed', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const [key, cb] = frames.entries().next().value as [
      number,
      FrameRequestCallback,
    ];
    frames.delete(key);
    cb(t);
  };
  const seek = vi.fn(
    (_time: number, _signal: AbortSignal) => new Promise<void>(() => {}),
  );
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 10,
      onPause: vi.fn(),
      onSeek: seek,
    }),
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    hook.result.current.stopReversePlayback(true);
    hook.result.current.startReversePlayback(2);
  });
  expect(frames.size).toBe(0);
  expect(seek).toHaveBeenCalledTimes(1);
  hook.unmount();
  vi.unstubAllGlobals();
});

it('preserves a short re-press until the previous image is confirmed', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (time: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](time);
  };
  let resolveFirst = (_time: number): void => {};
  const seek = vi.fn(
    (_time: number, _signal: AbortSignal) =>
      new Promise<number>((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 10,
      onPause: vi.fn(),
      onSeek: seek,
    }),
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    tick(1100);
    hook.result.current.stopReversePlayback(true);
    hook.result.current.startReversePlayback(2);
    hook.result.current.stopReversePlayback(true);
  });
  expect(seek).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveFirst(9.9);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(seek).toHaveBeenCalledTimes(2);
  expect(seek.mock.calls[1][0]).toBeLessThan(9.9);
  expect(seek.mock.calls[1][0]).toBeGreaterThanOrEqual(9.7);
  hook.unmount();
  vi.unstubAllGlobals();
});

it('invalidates a queued re-press when a new operation cancels the gesture', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](t);
  };
  let finish = (_time: number): void => {};
  const seek = vi.fn(
    (_time: number, _signal: AbortSignal) =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 10,
      onPause: vi.fn(),
      onSeek: seek,
    }),
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    hook.result.current.stopReversePlayback(true);
    hook.result.current.startReversePlayback(2);
    hook.result.current.stopReversePlayback(true);
    hook.result.current.cancelReversePlayback();
  });
  await act(async () => {
    finish(9.9);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(seek).toHaveBeenCalledTimes(1);
  expect(hook.result.current.isReverseSettled()).toBe(true);
  hook.unmount();
  vi.unstubAllGlobals();
});

it('does not guess a re-press origin when a completed seek has no confirmed image', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](t);
  };
  const onError = vi.fn();
  const onSeek = vi.fn(async () => null);
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 10,
      onPause: vi.fn(),
      onSeek,
      onError,
    }),
  );
  await act(async () => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    hook.result.current.stopReversePlayback(true);
    await Promise.resolve();
    await Promise.resolve();
  });
  act(() => hook.result.current.startReversePlayback(2));
  expect(onSeek).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'REVERSE_CONFIRMED_TIME_UNAVAILABLE' }),
  );
  hook.unmount();
  vi.unstubAllGlobals();
});

it('drains the lower-bound image after key release', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](t);
  };
  let finish = (_time: number): void => {};
  const onSeek = vi.fn(
    (_time: number, _signal: AbortSignal) =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 0.15,
      onPause: vi.fn(),
      onSeek,
    }),
  );
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    tick(1100);
    hook.result.current.stopReversePlayback(true);
  });
  expect(onSeek).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(0.05);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onSeek).toHaveBeenCalledTimes(2);
  expect(onSeek.mock.calls[1][0]).toBe(0);
  hook.unmount();
  vi.unstubAllGlobals();
});

it('does not enqueue a re-press if pause synchronously cancels its generation', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const tick = (t: number): void => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error('missing frame');
    frames.delete(entry[0]);
    entry[1](t);
  };
  let finish = (_time: number): void => {};
  let cancel = (): void => {};
  let pauses = 0;
  const onSeek = vi.fn(
    (_time: number, _signal: AbortSignal) =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() =>
    useContinuousReversePlayback({
      currentTime: 10,
      onPause: () => {
        if (++pauses === 2) cancel();
      },
      onSeek,
    }),
  );
  cancel = hook.result.current.cancelReversePlayback;
  act(() => {
    hook.result.current.startReversePlayback(2);
    tick(1000);
    tick(1050);
    hook.result.current.stopReversePlayback(true);
    hook.result.current.startReversePlayback(2);
  });
  await act(async () => {
    finish(9.9);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onSeek).toHaveBeenCalledTimes(1);
  expect(hook.result.current.isReverseSettled()).toBe(true);
  hook.unmount();
  vi.unstubAllGlobals();
});
