// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import type { NativePlaybackGroupBinding } from '../../../../types/ipc/nativePlaybackGroup';
import { restoreNativeGroupOriginal } from './nativeGroupOriginalRecovery';
const group = (): NativePlaybackGroupBinding => ({
  audioAngleId: 'left',
  angles: [
    {
      angleId: 'left',
      clipId: 'a',
      sourceUrl: 'file:///same.mp4',
      sourceTimeOffset: 0,
      globalStart: 0,
      globalEnd: 10,
      sourceEnd: 10,
      audioTracks: 3,
    },
    {
      angleId: 'right',
      clipId: 'b',
      sourceUrl: 'file:///same.mp4',
      sourceTimeOffset: 2,
      globalStart: 0,
      globalEnd: 10,
      sourceEnd: 12,
      audioTracks: 3,
    },
  ],
});
const controls = {
  playing: false,
  rate: 2,
  volume: 0.4,
  muted: false,
  audioTrack: 2,
};
const makePort = (duration: number) => {
  const listeners = new Map<string, Set<() => void>>();
  let time = 0,
    seeking = false,
    ready = 2,
    source = 'file:///same.mp4';
  const settings = {
    rate: 1,
    volume: 0.7,
    muted: true,
    audio: [true, false, false],
  };
  const emit = (event: string): void => {
    for (const fn of [...(listeners.get(event) ?? [])]) fn();
  };
  const port: CachePlayerPort = {
    source: () => source,
    paused: () => true,
    duration: () => duration,
    ready: () => ready,
    seeking: () => seeking,
    time: () => time,
    settings: () => settings,
    pause: vi.fn(),
    restore: vi.fn(),
    setSource: vi.fn(),
    seek: vi.fn((value) => {
      time = value;
      seeking = true;
      ready = 1;
    }),
    on: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)?.add(fn);
    },
    off: (name, fn) => {
      listeners.get(name)?.delete(fn);
    },
  };
  return {
    port,
    settings,
    emit,
    complete: (value?: number): void => {
      if (value !== undefined) time = value;
      seeking = false;
      ready = 2;
      emit('seeked');
    },
    change: (): void => {
      source = 'file:///new.mp4';
      emit('emptied');
    },
    listening: (): number =>
      [...listeners.values()].reduce((sum, value) => sum + value.size, 0),
  };
};
const setup = () => {
  const a = makePort(10),
    b = makePort(12),
    signal = new AbortController();
  const originals = new Map([
    ['left', { port: a.port, snapshot: { time: 0, settings: a.settings } }],
    ['right', { port: b.port, snapshot: { time: 2, settings: b.settings } }],
  ]);
  return { a, b, signal, originals };
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it('requires both same-URL slots at their mapped times and restores only the selected audio owner', async () => {
  const s = setup();
  let finished = false;
  const pending = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  ).then(() => {
    finished = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(s.a.port.seek).toHaveBeenCalledWith(3);
  expect(s.b.port.seek).toHaveBeenCalledWith(5);
  expect(s.a.port.restore).toHaveBeenCalledWith(
    { rate: 2, volume: 0.4, muted: false, audio: [false, false, true] },
    3,
  );
  expect(s.b.port.restore).toHaveBeenCalledWith(
    { rate: 2, volume: 0.7, muted: true, audio: [true, false, false] },
    3,
  );
  s.a.complete();
  await vi.advanceTimersByTimeAsync(0);
  expect(finished).toBe(false);
  s.b.complete();
  await pending;
  expect(finished).toBe(true);
  expect(s.a.listening() + s.b.listening()).toBe(0);
});
it('validates both ranges/audio owners before either port is mutated instead of clamping a package seek', async () => {
  const s = setup();
  await expect(
    restoreNativeGroupOriginal(
      group(),
      s.originals,
      10.1,
      controls,
      s.signal.signal,
      () => {},
    ),
  ).rejects.toThrow('SOURCE');
  expect(s.a.port.seek).not.toHaveBeenCalled();
  expect(s.b.port.pause).not.toHaveBeenCalled();
  s.b.settings.muted = false;
  await expect(
    restoreNativeGroupOriginal(
      group(),
      s.originals,
      3,
      controls,
      s.signal.signal,
      () => {},
    ),
  ).rejects.toThrow('MULTIPLE_AUDIO');
  expect(s.a.port.restore).not.toHaveBeenCalled();
});
it('preserves the first actual media failure and removes peer listeners without claiming browser seek cancellation', async () => {
  const s = setup();
  const task = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  );
  const rejected = expect(task).rejects.toThrow('MEDIA_ERROR');
  await vi.advanceTimersByTimeAsync(0);
  s.b.emit('error');
  await rejected;
  expect(s.a.listening() + s.b.listening()).toBe(0);
  s.a.complete(); // An already-issued browser seek can still finish; it cannot publish group success.
});
it('cleans up a pending peer even if the other disposed-port getter throws synchronously', async () => {
  const s = setup();
  const original = s.a.port.seek;
  let disposed = false;
  s.a.port.seek = (time) => {
    original(time);
    disposed = true;
  };
  s.b.port.source = () => {
    if (disposed) throw Error('disposed getter');
    return 'file:///same.mp4';
  };
  const task = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  );
  await expect(task).rejects.toThrow('disposed getter');
  expect(s.a.listening() + s.b.listening()).toBe(0);
});
it('rejects owner replacement after both decoder completions rather than accepting old images', async () => {
  const s = setup();
  let current = true;
  const task = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {
      if (!current) throw Error('new owner');
    },
  );
  const rejected = expect(task).rejects.toThrow('new owner');
  await vi.advanceTimersByTimeAsync(0);
  current = false;
  s.a.complete();
  s.b.complete();
  await rejected;
  expect(s.a.listening() + s.b.listening()).toBe(0);
});
it('times out the whole pair when one side never confirms and releases all attempt listeners', async () => {
  const s = setup();
  const task = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  );
  const rejected = expect(task).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(0);
  s.a.complete();
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(s.a.listening() + s.b.listening()).toBe(0);
});
it('revokes an old attempt while a later target waits for its own images, without cross-cancelling it', async () => {
  const s = setup();
  const first = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  );
  const oldRejected = expect(first).rejects.toThrow('CANCELLED');
  await vi.advanceTimersByTimeAsync(0);
  s.signal.abort();
  await oldRejected;
  const secondSignal = new AbortController();
  let done = false;
  const next = restoreNativeGroupOriginal(
    group(),
    s.originals,
    4,
    controls,
    secondSignal.signal,
    () => {},
  ).then(() => {
    done = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  s.a.complete(3);
  s.b.complete(5);
  await vi.advanceTimersByTimeAsync(0);
  expect(done).toBe(false);
  s.a.complete(4);
  s.b.complete(6);
  await next;
  expect(done).toBe(true);
  expect(s.a.listening() + s.b.listening()).toBe(0);
});

it('rejects nonfinite readiness/clock changes after one side had confirmed', async () => {
  const s = setup();
  const task = restoreNativeGroupOriginal(
    group(),
    s.originals,
    3,
    controls,
    s.signal.signal,
    () => {},
  );
  const rejected = expect(task).rejects.toThrow('UNCONFIRMED');
  await vi.advanceTimersByTimeAsync(0);
  s.a.complete();
  await vi.advanceTimersByTimeAsync(0);
  s.a.port.time = () => Number.NaN;
  s.b.complete();
  await rejected;
  expect(s.a.listening() + s.b.listening()).toBe(0);
});
