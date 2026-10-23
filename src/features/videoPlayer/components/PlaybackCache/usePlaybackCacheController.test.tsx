/* @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlaybackCacheSnapshot } from '../../../../types/ipc/playbackCache';
import type { CachePlayerPort } from './cachePlayerSwitch';
import { usePlaybackCacheController } from './usePlaybackCacheController';

const fixture = async () => {
  const snapshot: PlaybackCacheSnapshot = {
    generation: 'generation',
    source: {
      key: 'source-key',
      url: 'file:///original.mp4',
      label: 'source',
      audioTracks: 3,
    },
    status: {
      phase: 'ready',
      selected: 'original',
      progress: null,
      error: null,
    },
    available: true,
    maximumCacheBytes: 10000,
    reserveBytes: 1000,
  };
  const ack = Promise.withResolvers<void>();
  const api = {
    inspect: vi.fn(async () => structuredClone(snapshot)),
    prepare: vi.fn(),
    cancel: vi.fn(),
    cleanup: vi.fn(),
    candidate: vi.fn(async () => ({
      url: 'file:///cache.mp4',
      ticket: 'ticket',
      audioTracks: 3,
    })),
    selected: vi.fn(async (request: { ticket: string | null }) => {
      if (request.ticket) {
        await ack.promise;
        snapshot.status.selected = 'cache';
      } else snapshot.status.selected = 'original';
    }),
  };
  Object.defineProperty(window, 'electronAPI', {
    value: { playbackCache: api },
    configurable: true,
  });
  const callbacks = new Map<string, Set<() => void>>();
  const emit = (event: string): void => {
    [...(callbacks.get(event) ?? [])].forEach((listener) => listener());
  };
  let source = 'file:///original.mp4';
  let time = 17;
  let ready = 4;
  let seeking = false;
  let originalAudioAvailable = true;
  const port: CachePlayerPort = {
    paused: () => true,
    time: () => time,
    duration: () => 90,
    ready: () => ready,
    seeking: () => seeking,
    source: () => source,
    pause: vi.fn(),
    setSource: vi.fn((value) => {
      source = value;
      time = 0;
      ready = 0;
      emit('emptied');
      queueMicrotask(() => {
        ready = 1;
        emit('loadedmetadata');
        ready = 2;
        seeking = false;
        emit('seeked');
      });
    }),
    seek: vi.fn((value) => {
      time = value;
      seeking = true;
    }),
    settings: () => ({
      volume: 0.4,
      muted: false,
      rate: 1,
      audio: [false, true, false],
    }),
    restore: vi.fn((_settings, tracks) => {
      if (
        source === 'file:///original.mp4' &&
        !originalAudioAvailable &&
        tracks > 1
      )
        throw Error('audio unavailable');
    }),
    on: (event, listener) => {
      if (!callbacks.has(event)) callbacks.set(event, new Set());
      callbacks.get(event)?.add(listener);
    },
    off: (event, listener) => {
      callbacks.get(event)?.delete(listener);
    },
  };
  const hook = renderHook(
    ({ timeline }) =>
      usePlaybackCacheController(true, false, timeline, vi.fn()),
    { initialProps: { timeline: 17 } },
  );
  await waitFor(() =>
    expect(hook.result.current.snapshot?.source).not.toBeNull(),
  );
  let unregister: () => void = () => undefined;
  const suppressMetadata = vi.fn();
  act(() => {
    unregister = hook.result.current.context.register({
      source: 'file:///original.mp4',
      port,
      suppressMetadata,
    });
  });
  return {
    ...hook,
    ack,
    api,
    port,
    emit,
    snapshot,
    unregister,
    suppressMetadata,
    move: (value: number) => {
      time = value;
    },
    loseOriginalAudio: () => {
      originalAudioAvailable = false;
    },
  };
};
afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'electronAPI', {
    value: undefined,
    configurable: true,
  });
});
it('rolls back a media error during the selected ACK wait and preserves the known audio selection', async () => {
  const { result, api, ack, emit, port } = await fixture();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(api.selected).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: 'ticket' }),
    ),
  );
  act(() => emit('error'));
  await act(async () => {
    ack.resolve();
  });
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.setSource).toHaveBeenLastCalledWith('file:///original.mp4');
  expect(port.restore).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: [false, true, false] }),
    3,
  );
  expect(api.selected).toHaveBeenLastCalledWith(
    expect.objectContaining({ ticket: null }),
  );
  expect(result.current.error).not.toBeNull();
});
it('reports a rollback audio failure instead of treating missing native tracks as restored', async () => {
  const { result, api, ack, emit, port, loseOriginalAudio, suppressMetadata } =
    await fixture();
  act(() => result.current.onUseCache());
  await waitFor(() => expect(api.selected).toHaveBeenCalled());
  loseOriginalAudio();
  act(() => emit('error'));
  await act(async () => {
    ack.resolve();
  });
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.restore).toHaveBeenLastCalledWith(expect.anything(), 3);
  expect(result.current.error).not.toBeNull();
  expect(suppressMetadata).not.toHaveBeenCalledWith(false);
});
it('uses the latest paused position after candidate hash I/O and keeps adoption manual', async () => {
  const { result, api, ack, port, move } = await fixture();
  const candidate = Promise.withResolvers<{
    url: string;
    ticket: string;
    audioTracks: number;
  }>();
  api.candidate.mockReturnValue(candidate.promise);
  expect(port.setSource).not.toHaveBeenCalled();
  act(() => result.current.onUseCache());
  act(() => {
    move(23);
  });
  await act(async () => {
    candidate.resolve({
      url: 'file:///cache.mp4',
      ticket: 'ticket',
      audioTracks: 3,
    });
    ack.resolve();
  });
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.seek).toHaveBeenLastCalledWith(23);
  expect(result.current.error).toBeNull();
});
it('ignores a late candidate when the mounted player is replaced', async () => {
  const { result, api, port, unregister } = await fixture();
  const candidate = Promise.withResolvers<{
    url: string;
    ticket: string;
    audioTracks: number;
  }>();
  api.candidate.mockReturnValue(candidate.promise);
  act(() => result.current.onUseCache());
  act(() => unregister());
  await act(async () => {
    candidate.resolve({
      url: 'file:///cache.mp4',
      ticket: 'ticket',
      audioTracks: 3,
    });
  });
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.setSource).not.toHaveBeenCalled();
});
