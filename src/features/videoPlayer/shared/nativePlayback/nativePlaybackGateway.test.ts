import { afterEach, expect, it, vi } from 'vitest';
import { openQualifiedNativePlayback } from './nativePlaybackGateway';
import { htmlPlaybackAllowed } from './playbackAuthority';
import { getNativePlayback } from './nativePlaybackRegistry';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';

const owner = { generation: 'gateway', sourceKey: 'a'.repeat(64) };
const availability = {
  available: true,
  presentation: null,
  owner,
  sourceUrl: 'file:///synthetic.mp4',
  sourceEnd: null,
  reason: null,
};
const drained = {
  generation: owner.generation,
  nativeDrained: true,
  processStarted: false,
  processExited: true,
  pipesClosed: true,
  stopped: null,
};
const make = () => {
  vi.useFakeTimers();
  const close = vi.fn(async () => drained);
  const api = {
    inspect: vi.fn(),
    open: vi.fn(async () => {}),
    apply: vi.fn(async () => {}),
    onSnapshot: vi.fn(() => () => {}),
    observe: vi.fn(async () => ({
      intent: null,
      observation: null,
      lastConfirmedTime: 5,
      error: null,
      closing: false,
      closed: false,
    })),
    close,
  };
  vi.stubGlobal('window', { electronAPI: { nativePlayback: api } });
  const events = new Map<string, Set<() => void>>();
  const emit = (name: string) => {
    for (const fn of events.get(name) ?? []) fn();
  };
  let time = 5;
  const player: CachePlayerPort = {
    paused: () => true,
    time: () => time,
    duration: () => 20,
    ready: () => 2,
    seeking: () => false,
    source: () => availability.sourceUrl,
    setSource: vi.fn(() => {
      emit('emptied');
      emit('loadedmetadata');
    }),
    seek: vi.fn((value) => {
      time = value;
      emit('seeked');
    }),
    pause: vi.fn(),
    settings: () => ({
      rate: 1,
      volume: 0.5,
      muted: true,
      audio: [true, false, false],
    }),
    restore: vi.fn(),
    on: (name, fn) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(fn);
    },
    off: (name, fn) => {
      events.get(name)?.delete(fn);
    },
  };
  return { api, player, events };
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('releases a failed constructor before opening native', async () => {
  const { api, player } = make();
  expect(() =>
    openQualifiedNativePlayback(
      availability,
      player,
      () => {
        throw Error('pause failed');
      },
      () => {},
    ),
  ).toThrow('pause failed');
  await vi.advanceTimersByTimeAsync(1);
  expect(api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(getNativePlayback()).toBeNull();
});
it('retains the lease until native drain and stopped original source restoration finish', async () => {
  const { api, player, events } = make();
  const pending = Promise.withResolvers<typeof drained>();
  api.close.mockReturnValueOnce(pending.promise);
  const controller = openQualifiedNativePlayback(
    availability,
    player,
    vi.fn(),
    () => {},
  );
  await vi.advanceTimersByTimeAsync(1);
  const recovery = controller.returnToOriginal();
  expect(htmlPlaybackAllowed()).toBe(false);
  expect(player.setSource).not.toHaveBeenCalled();
  pending.resolve(drained);
  await recovery;
  expect(player.seek).toHaveBeenCalledWith(5);
  expect(player.restore).toHaveBeenCalledWith(
    { rate: 1, volume: 0.5, muted: true, audio: [true, false, false] },
    3,
  );
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(getNativePlayback()).toBeNull();
  expect([...events.values()].every((listeners) => listeners.size === 0)).toBe(
    true,
  );
});

it('retains one pending decoder seek across guarded recovery attempts when only controls change', async () => {
  const { player, events } = make();
  let target = 5,
    seeking = false;
  player.time = () => target;
  player.seeking = () => seeking;
  vi.mocked(player.seek).mockImplementation((time) => {
    target = time;
    seeking = true;
  });
  const controller = openQualifiedNativePlayback(
    {
      ...availability,
      presentation: {
        width: 1920,
        height: 1080,
        start: 0,
        end: 20,
        seekEnd: 19,
        playEnd: 19.5,
        rates: [1],
        audioTracks: 3,
        seekGrid: { origin: 0, duration: 1, timescale: 25 },
        mutedOnly: true,
        exactFloatVolume: true,
        audioSwitch: false,
      },
    },
    player,
    vi.fn(),
    () => {},
  );
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(5.123);
  await vi.advanceTimersByTimeAsync(1);
  controller.controls({ rate: 6 });
  await vi.advanceTimersByTimeAsync(1);
  expect(player.seek).toHaveBeenCalledTimes(1);
  expect(htmlPlaybackAllowed()).toBe(false);
  expect(player.restore).toHaveBeenLastCalledWith(
    expect.objectContaining({ rate: 6 }),
    3,
  );
  seeking = false;
  for (const listener of events.get('seeked') ?? []) listener();
  await controller.returnToOriginal();
  expect(controller.snapshot().time).toBe(5.123);
  expect(htmlPlaybackAllowed()).toBe(true);
});

it('passes the qualified source endpoint to recovery without replacing the source clock', async () => {
  const { player } = make();
  const end = 20.00020033333333;
  const restored = vi.fn();
  const controller = openQualifiedNativePlayback(
    {
      ...availability,
      sourceEnd: end,
      presentation: {
        width: 1920,
        height: 1080,
        start: 0,
        end: 20,
        seekEnd: 19,
        playEnd: 19.5,
        rates: [1],
        audioTracks: 3,
        seekGrid: null,
        mutedOnly: true,
        exactFloatVolume: true,
        audioSwitch: false,
      },
    },
    player,
    vi.fn(),
    () => {},
    restored,
  );
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(end);
  await controller.returnToOriginal();
  expect(player.seek).toHaveBeenCalledWith(20);
  expect(controller.snapshot()).toMatchObject({
    phase: 'original',
    time: end,
    error: null,
  });
  expect(restored).toHaveBeenCalledWith(
    end,
    expect.objectContaining({ playing: false, audioTrack: 0 }),
  );
  expect(htmlPlaybackAllowed()).toBe(true);
});
