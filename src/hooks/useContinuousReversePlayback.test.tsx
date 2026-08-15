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
    expect(onSeek).toHaveBeenLastCalledWith(9.9);

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

    expect(onSeek).toHaveBeenLastCalledWith(5);
    expect(callbacks.size).toBe(0);
  });
});
