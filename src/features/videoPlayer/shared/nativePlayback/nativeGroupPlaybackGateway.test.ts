// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openQualifiedNativeGroupPlayback } from './nativeGroupPlaybackGateway';
import { getNativePlayback } from './nativePlaybackRegistry';
import { htmlPlaybackAllowed } from './playbackAuthority';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
const owner = { generation: 'pair-gateway', sourceKey: 'a'.repeat(64) };
const closed = {
  generation: owner.generation,
  nativeDrained: true,
  processStarted: true,
  processExited: true,
  pipesClosed: true,
  stopped: null,
  presentedStop: {
    generation: owner.generation,
    document: 'doc',
    operation: 1,
    seekId: 1,
    pair: 1,
    globalTicks: 360000,
    ids: [1, 2],
  },
};
const availability = (): NativePlaybackAvailability => ({
  available: true,
  owner,
  sourceUrl: 'file:///native-group/opaque',
  sourceEnd: 10,
  reason: null,
  clockAuthority: 'drawn-pair',
  presentation: {
    width: 1920,
    height: 1080,
    start: 0,
    end: 10,
    seekEnd: 9.9,
    playEnd: 9.99,
    rates: [1, -0.5, -2, -4, -6],
    audioTracks: 3,
    seekGrid: null,
    mutedOnly: false,
    exactFloatVolume: false,
    audioSwitch: true,
  },
  group: {
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
  },
});
const port = (initial: number, duration: number) => {
  let time = initial,
    seeking = false;
  const listeners = new Map<string, Set<() => void>>();
  const settings = {
    rate: 1,
    volume: 0.7,
    muted: true,
    audio: [true, false, false],
  };
  const value: CachePlayerPort = {
    source: () => 'file:///same.mp4',
    time: () => time,
    duration: () => duration,
    ready: () => (seeking ? 1 : 2),
    seeking: () => seeking,
    paused: () => true,
    pause: vi.fn(),
    setSource: vi.fn(),
    settings: () => settings,
    restore: vi.fn(),
    seek: vi.fn((target) => {
      time = target;
      seeking = true;
    }),
    on: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)?.add(fn);
    },
    off: (name, fn) => {
      listeners.get(name)?.delete(fn);
    },
  };
  const emit = (name: string): void => {
    for (const fn of [...(listeners.get(name) ?? [])]) fn();
  };
  return {
    value,
    settings,
    emit,
    complete: (): void => {
      seeking = false;
      emit('seeked');
    },
    listeners: (): number =>
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
};
const setup = () => {
  const a = port(3, 10),
    b = port(5, 12);
  const players = new Map([
    ['left', a.value],
    ['right', b.value],
  ]);
  const api = {
    inspect: vi.fn(),
    freezePresentation: vi.fn(),
    open: vi.fn(async () => {}),
    apply: vi.fn(async () => {}),
    observe: vi.fn(async () => ({
      intent: null,
      observation: null,
      lastConfirmedTime: 3,
      error: null,
      closing: false,
      closed: false,
    })),
    close: vi.fn(async () => closed),
    onSnapshot: vi.fn(() => () => {}),
  };
  vi.stubGlobal('window', { electronAPI: { nativePlayback: api } });
  return { a, b, players, api };
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('refuses partial-overlap timelines rather than opening without clip/blank recovery', () => {
  const f = setup(),
    raw = availability();
  raw.sourceEnd = 12;
  expect(() =>
    openQualifiedNativeGroupPlayback(raw, f.players, 3, vi.fn(), () => {}),
  ).toThrow('TIMELINE_RECOVERY_REQUIRED');
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
});
it('does not start native or leak authority if construction pause fails', async () => {
  const f = setup();
  expect(() =>
    openQualifiedNativeGroupPlayback(
      availability(),
      f.players,
      3,
      () => {
        throw Error('pause failure');
      },
      () => {},
    ),
  ).toThrow('pause failure');
  await vi.advanceTimersByTimeAsync(0);
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(getNativePlayback()).toBeNull();
});
it('rejects ambiguous audible originals and wrong slot positions before claiming the pair', () => {
  const f = setup();
  f.b.settings.muted = false;
  expect(() =>
    openQualifiedNativeGroupPlayback(
      availability(),
      f.players,
      3,
      vi.fn(),
      () => {},
    ),
  ).toThrow('ORIGINAL_UNQUALIFIED');
  f.b.settings.muted = true;
  expect(() =>
    openQualifiedNativeGroupPlayback(
      availability(),
      f.players,
      4,
      vi.fn(),
      () => {},
    ),
  ).toThrow('ORIGINAL_UNQUALIFIED');
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
});
it('retains one authority until Main drain and BOTH independently mapped original frames finish', async () => {
  const f = setup(),
    native = Promise.withResolvers<typeof closed>(),
    restored = vi.fn();
  f.api.close.mockReturnValueOnce(native.promise);
  const controller = openQualifiedNativeGroupPlayback(
    availability(),
    f.players,
    3,
    vi.fn(),
    () => {},
    restored,
  );
  await vi.advanceTimersByTimeAsync(1);
  const recovery = controller.returnToOriginal();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.a.value.seek).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(false);
  native.resolve(closed);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.a.value.seek).toHaveBeenCalledWith(3);
  expect(f.b.value.seek).toHaveBeenCalledWith(5);
  f.a.complete();
  await vi.advanceTimersByTimeAsync(0);
  expect(restored).not.toHaveBeenCalled();
  expect(getNativePlayback()).toBe(controller);
  expect(htmlPlaybackAllowed()).toBe(false);
  f.b.complete();
  await recovery;
  expect(restored).toHaveBeenCalledWith(
    3,
    expect.objectContaining({ playing: false }),
  );
  expect(getNativePlayback()).toBeNull();
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(f.a.listeners() + f.b.listeners()).toBe(0);
});
it('keeps failed peer restoration blocked, then permits a verified pair retry without reopening native', async () => {
  const f = setup(),
    restored = vi.fn();
  const controller = openQualifiedNativeGroupPlayback(
    availability(),
    f.players,
    3,
    vi.fn(),
    () => {},
    restored,
  );
  await vi.advanceTimersByTimeAsync(1);
  const rejected = expect(controller.returnToOriginal()).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(0);
  f.b.emit('error');
  await rejected;
  expect(restored).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(false);
  expect(getNativePlayback()).toBe(controller);
  f.a.complete();
  f.b.complete();
  await vi.advanceTimersByTimeAsync(0);
  await controller.returnToOriginal();
  expect(f.api.open).toHaveBeenCalledOnce();
  expect(f.api.close).toHaveBeenCalledOnce();
  expect(restored).toHaveBeenCalledOnce();
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(getNativePlayback()).toBeNull();
});

it('rejects non-finite original readiness without granting authority', () => {
  const f = setup();
  vi.spyOn(f.b.value, 'ready').mockReturnValue(NaN);
  expect(() =>
    openQualifiedNativeGroupPlayback(
      availability(),
      f.players,
      3,
      vi.fn(),
      () => {},
    ),
  ).toThrow('ORIGINAL_UNQUALIFIED');
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(f.api.open).not.toHaveBeenCalled();
});
it('keeps authority when a captured slot is replaced during native close, and only restores that exact slot on retry', async () => {
  const f = setup(),
    native = Promise.withResolvers<typeof closed>();
  f.api.close.mockReturnValueOnce(native.promise);
  const c = openQualifiedNativeGroupPlayback(
    availability(),
    f.players,
    3,
    vi.fn(),
    () => {},
  );
  await vi.advanceTimersByTimeAsync(1);
  const rejected = expect(c.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  f.players.set('right', port(5, 12).value);
  native.resolve(closed);
  await rejected;
  expect(f.a.value.seek).not.toHaveBeenCalled();
  expect(f.b.value.seek).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(false);
  f.players.set('right', f.b.value);
  const recovery = c.returnToOriginal();
  await vi.advanceTimersByTimeAsync(0);
  f.a.complete();
  f.b.complete();
  await recovery;
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(f.api.open).toHaveBeenCalledOnce();
});
