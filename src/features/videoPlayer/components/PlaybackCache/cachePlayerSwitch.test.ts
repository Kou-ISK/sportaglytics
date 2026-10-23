import { afterEach, expect, it, vi } from 'vitest';
import { snapshotCachePlayer, switchCachePlayer } from './cachePlayerSwitch';
import type { CachePlayerPort } from './cachePlayerSwitch';
const fixture = () => {
  const callbacks = new Map<string, Set<() => void>>();
  const emit = (event: string): void => {
    callbacks.get(event)?.forEach((listener) => listener());
  };
  let source = 'file:///original.mp4';
  let time = 17;
  let ready = 4;
  let seeking = false;
  let paused = true;
  const port: CachePlayerPort = {
    paused: () => paused,
    source: () => source,
    time: () => time,
    ready: () => ready,
    seeking: () => seeking,
    duration: () => 90,
    setSource: vi.fn((value) => {
      source = value;
      time = 0;
      ready = 0;
      emit('emptied');
    }),
    seek: vi.fn((value) => {
      time = value;
      seeking = true;
    }),
    pause: vi.fn(() => {
      paused = true;
    }),
    settings: () => ({
      volume: 0.4,
      muted: true,
      rate: 1.5,
      audio: [false, true, false],
    }),
    restore: vi.fn(),
    on: (event, listener) => {
      if (!callbacks.has(event)) callbacks.set(event, new Set());
      callbacks.get(event)?.add(listener);
    },
    off: (event, listener) => {
      callbacks.get(event)?.delete(listener);
    },
  };
  return {
    port,
    emit,
    listeners: () =>
      [...callbacks.values()].reduce((n, set) => n + set.size, 0),
    metadata: () => {
      ready = 1;
      emit('loadedmetadata');
    },
    decoded: () => {
      ready = 2;
      seeking = false;
      emit('seeked');
    },
    play: () => {
      paused = false;
      emit('play');
    },
  };
};
afterEach(() => vi.useRealTimers());
it('restores exact paused position and audio settings before completing; source metadata alone is insufficient', async () => {
  const fixtureData = fixture();
  const { port, metadata, decoded, listeners } = fixtureData;
  const snapshot = snapshotCachePlayer(port);
  let finished = false;
  const work = switchCachePlayer(
    port,
    'file:///cache.mp4',
    snapshot,
    3,
    new AbortController().signal,
  ).then(() => {
    finished = true;
  });
  metadata();
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(port.restore).toHaveBeenCalledWith(snapshot.settings, 3);
  expect(port.seek).toHaveBeenCalledWith(17);
  decoded();
  await work;
  expect(listeners()).toBe(0);
  expect(port.paused()).toBe(true);
});
it.each(['cancel', 'error', 'play', 'timeout'])(
  'fails %s without leaking listeners or starting playback',
  async (kind) => {
    vi.useFakeTimers();
    const fixtureData = fixture();
    const { port, emit, metadata, listeners, play } = fixtureData;
    const controller = new AbortController();
    const work = switchCachePlayer(
      port,
      'file:///cache.mp4',
      snapshotCachePlayer(port),
      3,
      controller.signal,
    );
    const rejected = expect(work).rejects.toThrow();
    metadata();
    if (kind === 'cancel') controller.abort();
    else if (kind === 'timeout') await vi.advanceTimersByTimeAsync(15000);
    else if (kind === 'play') play();
    else emit('error');
    await rejected;
    expect(listeners()).toBe(0);
    expect(port.paused()).toBe(true);
  },
);
it('refuses an active or unfinished seek before changing the source', () => {
  const { port, play } = fixture();
  play();
  expect(() => snapshotCachePlayer(port)).toThrow();
  expect(port.setSource).not.toHaveBeenCalled();
});

it('does not mistake old decoded/seeked events for metadata from the requested resource', async () => {
  const { port, emit } = fixture();
  let desired = 'file:///original.mp4';
  port.setSource = vi.fn((value) => {
    desired = value;
  });
  port.source = () => desired; // Adversarial adapter exposes desired src prematurely.
  const controller = new AbortController();
  const work = switchCachePlayer(
    port,
    'file:///cache.mp4',
    snapshotCachePlayer(port),
    3,
    controller.signal,
  );
  const rejected = expect(work).rejects.toThrow();
  emit('seeked');
  emit('loadeddata');
  expect(port.seek).not.toHaveBeenCalled();
  emit('emptied');
  emit('seeked');
  expect(port.seek).not.toHaveBeenCalled();
  controller.abort();
  await rejected;
});
