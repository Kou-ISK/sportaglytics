// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CachePlayerPort } from '../PlaybackCache/cachePlayerSwitch';
import { useNativePlaybackPanel } from './useNativePlaybackPanel';
import { registerNativeSurface } from '../../shared/nativePlayback/nativeSurfaceBinding';
import { openQualifiedNativePlayback } from '../../shared/nativePlayback/nativePlaybackGateway';

vi.mock('../../shared/nativePlayback/nativePlaybackGateway', () => ({
  openQualifiedNativePlayback: vi.fn(),
}));
const descriptor = Object.getOwnPropertyDescriptor(window, 'electronAPI');
afterEach(() => {
  if (descriptor) Object.defineProperty(window, 'electronAPI', descriptor);
  else Reflect.deleteProperty(window, 'electronAPI');
  vi.clearAllMocks();
});

it('updates start eligibility on settings/seek without reprobing, and keeps an unsupported race on the original', async () => {
  const source = 'file:///synthetic.mp4';
  const presentation = {
    width: 1920,
    height: 1080,
    start: 0,
    end: 100,
    seekEnd: 98,
    playEnd: 99,
    rates: [1],
    audioTracks: 3,
    seekGrid: null,
    mutedOnly: true,
    exactFloatVolume: true,
    audioSwitch: false,
  };
  const inspect = vi.fn(async () => ({
    available: true,
    reason: null,
    sourceUrl: source,
    sourceEnd: null,
    owner: { generation: 'trial', sourceKey: 'a'.repeat(64) },
    presentation,
  }));
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { nativePlayback: { inspect }, nativeSurface: {} },
  });
  let rate = 2,
    time = 10;
  const listeners = new Map<string, () => void>();
  const port: CachePlayerPort = {
    paused: () => true,
    time: () => time,
    duration: () => 100,
    ready: () => 4,
    seeking: () => false,
    source: () => source,
    settings: () => ({
      rate,
      volume: 0.5,
      muted: true,
      audio: [true, false, false],
    }),
    setSource: vi.fn(),
    seek: vi.fn(),
    pause: vi.fn(),
    restore: vi.fn(),
    on: (event, fn) => {
      listeners.set(event, fn);
    },
    off: (event) => {
      listeners.delete(event);
    },
  };
  const releaseSurface = registerNativeSurface(source);
  const hook = renderHook(() =>
    useNativePlaybackPanel(true, false, vi.fn(), vi.fn()),
  );
  let unregister = (): void => {};
  try {
    act(() => {
      unregister = hook.result.current.register({
        source,
        port,
        suppressMetadata: vi.fn(),
      });
    });
    await waitFor(() =>
      expect(hook.result.current.view?.unavailableReason).toContain('1×'),
    );
    expect(hook.result.current.view?.canOpen).toBe(false);
    const calls = inspect.mock.calls.length;
    act(() => {
      rate = 1;
      listeners.get('ratechange')?.();
    });
    expect(hook.result.current.view?.canOpen).toBe(true);
    expect(inspect).toHaveBeenCalledTimes(calls);
    act(() => {
      time = 99.5;
      listeners.get('seeked')?.();
    });
    expect(hook.result.current.view?.canOpen).toBe(false);
    act(() => {
      time = 10;
      listeners.get('seeked')?.();
    });
    expect(hook.result.current.view?.canOpen).toBe(true);
    rate = 2; // Setting changes between rendering the button and handling it.
    await act(async () => {
      hook.result.current.view?.onOpen();
    });
    expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
    expect(port.pause).not.toHaveBeenCalled();
    expect(port.seek).not.toHaveBeenCalled();
    expect(hook.result.current.view?.error).toBeNull();
    expect(hook.result.current.view?.canOpen).toBe(false);
  } finally {
    act(unregister);
    hook.unmount();
    releaseSurface();
  }
  expect(listeners.size).toBe(0);
});
