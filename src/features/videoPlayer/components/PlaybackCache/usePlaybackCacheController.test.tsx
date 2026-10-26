/* @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlaybackCacheSnapshot } from '../../../../types/ipc/playbackCache';
import type { CachePlayerPort } from './cachePlayerSwitch';
import { usePlaybackCacheController } from './usePlaybackCacheController';
import { claimNativePlayback } from '../../shared/nativePlayback/playbackAuthority';

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
    reuse: vi.fn(),
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
    ({ timeline, playing }) =>
      usePlaybackCacheController(true, playing, timeline, vi.fn()),
    { initialProps: { timeline: 17, playing: false } },
  );
  await waitFor(() =>
    expect(hook.result.current.snapshot?.source?.url).toBe(
      snapshot.source?.url,
    ),
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
    restoreOriginalAudio: () => {
      originalAudioAvailable = true;
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
it('clears a transient inspection error after the next successful poll', async () => {
  const { result, api } = await fixture();
  api.inspect.mockRejectedValueOnce(Error('CACHE_UNAUTHORIZED'));
  await waitFor(
    () =>
      expect(result.current.error).toBe(
        '再生用コピーの状態を取得できませんでした。',
      ),
    { timeout: 2000 },
  );
  await waitFor(() => expect(result.current.error).toBeNull(), {
    timeout: 2000,
  });
});

it('does not clear an operation error when inspection recovers', async () => {
  const { result, api } = await fixture();
  api.prepare.mockImplementationOnce(() => {
    throw Error('CACHE_BUSY');
  });
  act(() => result.current.onPrepare());
  const message =
    '処理を完了できませんでした。状態を確認して再試行してください。';
  await waitFor(() => expect(result.current.error).toBe(message));
  const calls = api.inspect.mock.calls.length;
  await waitFor(
    () => expect(api.inspect.mock.calls.length).toBeGreaterThan(calls),
    { timeout: 2000 },
  );
  expect(result.current.error).toBe(message);
});

it('ignores an older poll failure after a newer operation refresh succeeds', async () => {
  const { result, api } = await fixture();
  const older = Promise.withResolvers<PlaybackCacheSnapshot>();
  const calls = api.inspect.mock.calls.length;
  api.inspect.mockReturnValueOnce(older.promise);
  await waitFor(() => expect(api.inspect.mock.calls.length).toBe(calls + 1), {
    timeout: 2000,
  });
  act(() => result.current.onCancel());
  await waitFor(() => expect(api.inspect.mock.calls.length).toBe(calls + 2));
  await act(async () => older.reject(Error('stale inspection')));
  expect(result.current.error).toBeNull();
});

it('ignores a pending inspection after the playback screen becomes ineligible', async () => {
  const existing = await fixture();
  existing.unmount();
  const pending = Promise.withResolvers<PlaybackCacheSnapshot>();
  existing.api.inspect.mockReturnValueOnce(pending.promise);
  const hook = renderHook(
    ({ eligible }) => usePlaybackCacheController(eligible, false, 0, vi.fn()),
    { initialProps: { eligible: true } },
  );
  hook.rerender({ eligible: false });
  await act(async () => pending.reject(Error('old playback screen')));
  expect(hook.result.current.error).toBeNull();
});

it('reserves source authority through candidate and selected ACK waits', async () => {
  const { result, api, ack } = await fixture();
  const candidate = Promise.withResolvers<{
    url: string;
    ticket: string;
    audioTracks: number;
  }>();
  api.candidate.mockReturnValueOnce(candidate.promise);
  act(() => result.current.onUseCache());
  expect(() => {
    const release = claimNativePlayback();
    release();
  }).toThrow('PLAYBACK_AUTHORITY_BUSY');
  await act(async () => {
    candidate.resolve({
      url: 'file:///cache.mp4',
      ticket: 'ticket',
      audioTracks: 3,
    });
  });
  await waitFor(() => expect(api.selected).toHaveBeenCalled());
  expect(() => {
    const release = claimNativePlayback();
    release();
  }).toThrow('PLAYBACK_AUTHORITY_BUSY');
  await act(async () => {
    ack.resolve();
  });
  await waitFor(() => expect(result.current.switching).toBe(false));
  const release = claimNativePlayback();
  release();
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
  expect(api.selected).not.toHaveBeenCalledWith(
    expect.objectContaining({ ticket: null }),
  );
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

it('pauses and reports a successful automatic original recovery exactly once', async () => {
  const { result, ack, emit, port, api } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  act(() => emit('error'));
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.setSource).toHaveBeenCalledTimes(2);
  expect(port.source()).toBe('file:///original.mp4');
  expect(port.time()).toBe(17);
  expect(result.current.error).toContain('原本へ戻して停止');
  expect(api.selected).toHaveBeenLastCalledWith(
    expect.objectContaining({ ticket: null }),
  );
  act(() => {
    emit('error');
    emit('error');
  });
  expect(port.setSource).toHaveBeenCalledTimes(2);
});
it('does not ACK or retry a failed automatic audio restoration; manual retry remains possible', async () => {
  const { result, ack, emit, port, api, loseOriginalAudio } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  loseOriginalAudio();
  act(() => emit('error'));
  await waitFor(() => expect(result.current.error).toContain('復旧は未確認'));
  expect(port.setSource).toHaveBeenCalledTimes(2);
  expect(api.selected).toHaveBeenCalledTimes(1);
  act(() => {
    emit('error');
    emit('error');
  });
  expect(port.setSource).toHaveBeenCalledTimes(2);
  expect(port.pause).toHaveBeenCalled();
  act(() => result.current.onUseOriginal());
  await waitFor(() => expect(port.setSource).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(api.selected).toHaveBeenCalledTimes(1);
});
it('keeps monitoring media errors while original ACK is pending without a second restoration', async () => {
  const { result, ack, emit, port, api, snapshot } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  const originalAck = Promise.withResolvers<void>();
  api.selected.mockImplementationOnce(async () => {
    snapshot.status.selected = 'original';
    return originalAck.promise;
  });
  act(() => emit('error'));
  await waitFor(() => expect(api.selected).toHaveBeenCalledTimes(2));
  act(() => {
    emit('error');
    emit('error');
  });
  await act(async () => originalAck.resolve());
  await waitFor(() => expect(result.current.error).toContain('復旧は未確認'));
  expect(port.setSource).toHaveBeenCalledTimes(2);
  act(() => emit('error'));
  expect(port.setSource).toHaveBeenCalledTimes(2);
  await waitFor(
    () => expect(result.current.snapshot?.status.selected).toBe('original'),
    { timeout: 2000 },
  );
  expect(result.current.onRetryOriginal).not.toBeNull();
  act(() => result.current.onRetryOriginal?.());
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.time()).toBe(17);
  expect(result.current.onRetryOriginal).toBeNull();
});

it('retains the pre-failure position and audio selection when retrying after a partial reload reset', async () => {
  const {
    result,
    ack,
    emit,
    port,
    loseOriginalAudio,
    restoreOriginalAudio,
    rerender,
  } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  loseOriginalAudio();
  act(() => emit('error'));
  await waitFor(() => expect(result.current.onRetryOriginal).not.toBeNull());
  expect(port.time()).toBe(0);
  const stale = result.current.onRetryOriginal;
  rerender({ timeline: 20, playing: true });
  expect(result.current.onRetryOriginal).toBeNull();
  act(() => stale?.());
  expect(port.setSource).toHaveBeenCalledTimes(2);
  rerender({ timeline: 20, playing: false });
  restoreOriginalAudio();
  act(() => result.current.onRetryOriginal?.());
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.time()).toBe(20);
  expect(port.restore).toHaveBeenLastCalledWith(
    { volume: 0.4, muted: false, rate: 1, audio: [false, true, false] },
    3,
  );
  expect(result.current.error).toBeNull();
  expect(result.current.onRetryOriginal).toBeNull();
});

it.each(['session', 'registration'] as const)(
  'rejects a stale recovery action after a changed %s',
  async (change) => {
    const { result, ack, emit, port, snapshot, unregister, loseOriginalAudio } =
      await fixture();
    ack.resolve();
    act(() => result.current.onUseCache());
    await waitFor(() =>
      expect(result.current.snapshot?.status.selected).toBe('cache'),
    );
    loseOriginalAudio();
    act(() => emit('error'));
    await waitFor(() => expect(result.current.onRetryOriginal).not.toBeNull());
    const stale = result.current.onRetryOriginal;
    if (change === 'session') {
      snapshot.generation = 'new-generation';
      await waitFor(
        () =>
          expect(result.current.snapshot?.generation).toBe('new-generation'),
        { timeout: 2000 },
      );
    } else act(() => unregister());
    expect(result.current.onRetryOriginal).toBeNull();
    act(() => stale?.());
    expect(port.setSource).toHaveBeenCalledTimes(2);
  },
);

it('offers recovery after the original ACK but a failed final refresh and keeps the saved target', async () => {
  const { result, ack, emit, port, api, snapshot, move } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  const inspection = Promise.withResolvers<PlaybackCacheSnapshot>();
  api.inspect.mockReturnValue(inspection.promise);
  act(() => emit('error'));
  await waitFor(() => expect(api.selected).toHaveBeenCalledTimes(2));
  act(() => {
    move(0);
    emit('error');
  });
  await act(async () => inspection.resolve(structuredClone(snapshot)));
  await waitFor(() => expect(result.current.onRetryOriginal).not.toBeNull());
  expect(result.current.snapshot?.status.selected).toBe('original');
  api.inspect.mockImplementation(async () => structuredClone(snapshot));
  act(() => result.current.onRetryOriginal?.());
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(port.time()).toBe(17);
  expect(result.current.error).toBeNull();
});

it('does not claim rollback success when media fails during the final inspect wait', async () => {
  const { result, api, ack, emit } = await fixture();
  act(() => result.current.onUseCache());
  await waitFor(() => expect(api.selected).toHaveBeenCalledTimes(1));
  const inspection = Promise.withResolvers<PlaybackCacheSnapshot>();
  api.inspect.mockReturnValue(inspection.promise);
  act(() => emit('error'));
  await act(async () => ack.resolve());
  await waitFor(() => expect(api.selected).toHaveBeenCalledTimes(2));
  act(() => emit('error'));
  await act(async () =>
    inspection.resolve({
      generation: 'generation',
      source: null,
      status: {
        phase: 'ready',
        selected: 'original',
        progress: null,
        error: null,
      },
      available: true,
      maximumCacheBytes: 10000,
      reserveBytes: 1000,
    }),
  );
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(result.current.error).toContain('復旧は未確認');
});

it('stops the selected player even when a changed session prevents automatic restoration', async () => {
  const { result, ack, emit, port, snapshot } = await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  snapshot.source = null;
  await waitFor(() => expect(result.current.snapshot?.source).toBeNull(), {
    timeout: 2000,
  });
  const previous = vi.mocked(port.pause).mock.calls.length;
  act(() => emit('error'));
  expect(vi.mocked(port.pause).mock.calls.length).toBeGreaterThan(previous);
  expect(port.setSource).toHaveBeenCalledTimes(1);
});

it('does not read a disposed port through a retained recovery callback before React commits cleanup', async () => {
  const { result, ack, emit, port, unregister, loseOriginalAudio } =
    await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  loseOriginalAudio();
  act(() => emit('error'));
  await waitFor(() => expect(result.current.onRetryOriginal).not.toBeNull());
  const stale = result.current.onRetryOriginal;
  const paused = vi.fn(() => {
    throw Error('disposed');
  });
  act(() => {
    unregister();
    port.paused = paused;
    stale?.();
  });
  expect(paused).not.toHaveBeenCalled();
  expect(port.setSource).toHaveBeenCalledTimes(2);
});

it('rechecks Main generation before retrying even if the renderer poll still holds the old Session', async () => {
  const { result, ack, emit, port, api, snapshot, loseOriginalAudio } =
    await fixture();
  ack.resolve();
  act(() => result.current.onUseCache());
  await waitFor(() =>
    expect(result.current.snapshot?.status.selected).toBe('cache'),
  );
  loseOriginalAudio();
  act(() => emit('error'));
  await waitFor(() => expect(result.current.onRetryOriginal).not.toBeNull());
  const reads = api.inspect.mock.calls.length;
  api.inspect.mockResolvedValue({
    ...structuredClone(snapshot),
    generation: 'new-session',
  });
  act(() => result.current.onRetryOriginal?.());
  await waitFor(() => expect(result.current.switching).toBe(false));
  expect(api.inspect.mock.calls.length).toBeGreaterThan(reads);
  expect(port.setSource).toHaveBeenCalledTimes(2);
  expect(api.selected).toHaveBeenCalledTimes(1);
});
