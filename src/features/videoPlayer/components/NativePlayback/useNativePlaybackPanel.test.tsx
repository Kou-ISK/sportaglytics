// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CachePlayerPort } from '../PlaybackCache/cachePlayerSwitch';
import { useNativePlaybackPanel } from './useNativePlaybackPanel';
import { registerNativeSurface } from '../../shared/nativePlayback/nativeSurfaceBinding';
import { openQualifiedNativePlayback } from '../../shared/nativePlayback/nativePlaybackGateway';

vi.mock('../../shared/nativePlayback/nativePlaybackGateway', () => ({
  openQualifiedNativePlayback: vi.fn(),
}));
const descriptor = Object.getOwnPropertyDescriptor(window, 'electronAPI');
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  if (descriptor) Object.defineProperty(window, 'electronAPI', descriptor);
  else Reflect.deleteProperty(window, 'electronAPI');
  vi.resetAllMocks();
});
const setup = ({
  rate = 1,
  ready = 4,
  surface = true,
  available = true,
  paused = true,
} = {}) => {
  const source = 'file:///synthetic.mp4';
  const state = { rate, ready, time: 10, paused };
  const inspect = vi.fn(async () =>
    available
      ? {
          available: true,
          reason: null,
          sourceUrl: source,
          sourceEnd: null,
          owner: { generation: 'standard', sourceKey: 'a'.repeat(64) },
          presentation: {
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
          },
        }
      : {
          available: false,
          reason: 'unsupported',
          sourceUrl: null,
          sourceEnd: null,
          owner: null,
          presentation: null,
        },
  );
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { nativePlayback: { inspect }, nativeSurface: {} },
  });
  const listeners = new Map<string, () => void>();
  const port: CachePlayerPort = {
    paused: () => state.paused,
    time: () => state.time,
    duration: () => 100,
    ready: () => state.ready,
    seeking: () => false,
    source: () => source,
    settings: () => ({
      rate: state.rate,
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
  if (surface) cleanups.push(registerNativeSurface(source));
  const hook = renderHook(
    ({ playing }) => useNativePlaybackPanel(true, playing, vi.fn(), vi.fn()),
    { initialProps: { playing: !paused } },
  );
  let unregister = (): void => {};
  act(() => {
    unregister = hook.result.current.register({
      source,
      port,
      suppressMetadata: vi.fn(),
    });
  });
  cleanups.push(() => {
    act(unregister);
    hook.unmount();
    expect(listeners.size).toBe(0);
  });
  const event = (name: string): void => {
    act(() => {
      listeners.get(name)?.();
    });
  };
  const replace = (): void => {
    act(() => {
      unregister();
      unregister = hook.result.current.register({
        source,
        port,
        suppressMetadata: vi.fn(),
      });
    });
  };
  return { state, inspect, port, hook, event, source, replace };
};
it('automatically adopts an eligible ready original once, with no selection or repeated probes', async () => {
  const value = setup();
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
  value.event('seeked');
  value.event('volumechange');
  expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1);
  expect(value.inspect).toHaveBeenCalledTimes(1);
});
it('waits for the surface and decoded image rather than losing a late readiness event', async () => {
  const value = setup({ surface: false, ready: 0 });
  await waitFor(() => expect(value.inspect).toHaveBeenCalledTimes(1));
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  act(() => {
    cleanups.push(registerNativeSurface(value.source));
  });
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  value.state.ready = 4;
  value.event('loadeddata');
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
});
it('does not promise automatic re-entry after the document has used its native attempt', async () => {
  const value = setup();
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
  // The gateway mock leaves no native authority, as after a completed recovery.
  value.state.paused = false;
  value.hook.rerender({ playing: true });
  expect(value.hook.result.current.view?.unavailableReason).toContain(
    '再度開くと',
  );
  value.state.paused = true;
  value.hook.rerender({ playing: false });
  value.event('pause');
  expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1);
});
it('keeps unsupported rate and endpoint on compatible playback, then adopts a supported stopped position', async () => {
  const value = setup({ rate: 2 });
  await waitFor(() =>
    expect(value.hook.result.current.view?.unavailableReason).toContain('1×'),
  );
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  value.state.time = 99.5;
  value.state.rate = 1;
  value.event('ratechange');
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  value.state.time = 10;
  value.event('seeked');
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
  expect(value.inspect).toHaveBeenCalledTimes(1);
});
it('does not interrupt playback that started before qualification completed', async () => {
  const value = setup({ paused: false });
  await waitFor(() => expect(value.hook.result.current.view).not.toBeNull());
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  expect(value.port.pause).not.toHaveBeenCalled();
  value.state.paused = true;
  value.hook.rerender({ playing: false });
  value.event('pause');
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
});
it('retains compatible playback when qualification fails', async () => {
  const value = setup({ available: false });
  await waitFor(() => expect(value.inspect).toHaveBeenCalledTimes(1));
  value.event('loadeddata');
  value.event('seeked');
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  expect(value.port.pause).not.toHaveBeenCalled();
  expect(value.hook.result.current.view).toBeNull();
});
it('reports start failure without retrying on each settings or seek event', async () => {
  vi.mocked(openQualifiedNativePlayback).mockImplementation(() => {
    throw Error('NATIVE_TEST_FAILURE');
  });
  const value = setup();
  await waitFor(() =>
    expect(value.hook.result.current.view?.error).toContain('互換再生'),
  );
  value.event('seeked');
  value.event('volumechange');
  expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1);
  expect(value.inspect).toHaveBeenCalledTimes(1);
});

it('never opens a replacement registration with qualification from its predecessor', async () => {
  const value = setup();
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
  const old = await value.inspect.mock.results[0].value;
  const pending = Promise.withResolvers<typeof old>();
  value.inspect.mockReturnValueOnce(pending.promise);
  value.replace();
  await waitFor(() => expect(value.inspect).toHaveBeenCalledTimes(2));
  expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1);
  await act(async () => {
    pending.resolve({
      ...old,
      owner: { generation: 'new', sourceKey: 'a'.repeat(64) },
    });
  });
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(2),
  );
  expect(
    vi.mocked(openQualifiedNativePlayback).mock.calls[1][0].owner?.generation,
  ).toBe('new');
});

it('does not use a rendered qualification after a child effect replaces its registration in the same commit', async () => {
  const value = setup({ paused: false });
  await waitFor(() => expect(value.hook.result.current.view).not.toBeNull());
  const previous = await value.inspect.mock.results[0].value;
  value.hook.unmount();
  const Registrar = ({
    register,
    identity,
  }: {
    register: ReturnType<typeof useNativePlaybackPanel>['register'];
    identity: number;
  }) => {
    useEffect(
      () =>
        register({
          source: value.source,
          port: value.port,
          suppressMetadata: vi.fn(),
        }),
      [register, identity],
    );
    return null;
  };
  const Parent = ({
    identity,
    playing,
  }: {
    identity: number;
    playing: boolean;
  }) => {
    const panel = useNativePlaybackPanel(true, playing, vi.fn(), vi.fn());
    return <Registrar register={panel.register} identity={identity} />;
  };
  const view = render(<Parent identity={1} playing />);
  cleanups.push(() => view.unmount());
  await waitFor(() =>
    expect(value.inspect.mock.calls.length).toBeGreaterThanOrEqual(2),
  );
  await act(async () => {
    await Promise.resolve();
  });
  const pending = Promise.withResolvers<typeof previous>();
  value.inspect.mockReturnValueOnce(pending.promise);
  value.state.paused = true;
  view.rerender(<Parent identity={2} playing={false} />);
  expect(openQualifiedNativePlayback).not.toHaveBeenCalled();
  await act(async () => {
    pending.resolve({
      ...previous,
      owner: { generation: 'replacement', sourceKey: 'a'.repeat(64) },
    });
  });
  await waitFor(() =>
    expect(openQualifiedNativePlayback).toHaveBeenCalledTimes(1),
  );
  expect(
    vi.mocked(openQualifiedNativePlayback).mock.calls[0][0].owner?.generation,
  ).toBe('replacement');
});
