import { expect, it, vi } from 'vitest';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';
import { restoreNativeOriginal } from './nativeOriginalRecovery';
const make = () => {
  const events = new Map<string, Set<() => void>>();
  let time = 2,
    seeking = false;
  const settings = {
    rate: 6,
    volume: 0.3,
    muted: false,
    audio: [false, false, true],
  };
  const port: CachePlayerPort = {
    source: () => 'file:///synthetic.mp4',
    paused: () => true,
    time: () => time,
    ready: () => 2,
    seeking: () => seeking,
    duration: () => 100,
    pause: vi.fn(),
    setSource: vi.fn(),
    seek: vi.fn(() => {
      seeking = true;
    }),
    settings: () => settings,
    restore: vi.fn(),
    on: (name, fn) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(fn);
    },
    off: (name, fn) => {
      events.get(name)?.delete(fn);
    },
  };
  return {
    port,
    settings,
    finish: (value: number) => {
      time = value;
      seeking = false;
      for (const fn of events.get('seeked') ?? []) fn();
    },
    events,
  };
};
it('reuses the original source and restores all audio/rate settings before latest seek readiness', async () => {
  const { port, settings, finish, events } = make();
  const first = new AbortController();
  const old = restoreNativeOriginal(
    port,
    port.source(),
    { time: 20, settings },
    3,
    first.signal,
  );
  const rejected = expect(old).rejects.toThrow('NATIVE_ORIGINAL_CANCELLED');
  first.abort();
  await rejected;
  let ready = false;
  const next = restoreNativeOriginal(
    port,
    port.source(),
    { time: 40.123, settings },
    3,
    new AbortController().signal,
  ).then(() => {
    ready = true;
  });
  finish(20);
  await Promise.resolve();
  expect(ready).toBe(false);
  finish(40.123);
  await next;
  expect(port.setSource).not.toHaveBeenCalled();
  expect(port.restore).toHaveBeenLastCalledWith(settings, 3);
  expect([...events.values()].every((list) => list.size === 0)).toBe(true);
});
it('rejects a changed source and never changes it back silently', async () => {
  const { port, settings } = make();
  await expect(
    restoreNativeOriginal(
      port,
      'file:///other.mp4',
      { time: 3, settings },
      3,
      new AbortController().signal,
    ),
  ).rejects.toThrow('NATIVE_SOURCE_CHANGED');
  expect(port.seek).not.toHaveBeenCalled();
  expect(port.setSource).not.toHaveBeenCalled();
});

it.each([0.00000033333333, 0.00020033333333])(
  'preserves the qualified endpoint clock with HTML discrepancy %s',
  async (difference) => {
    const { port, settings, finish } = make();
    const duration = 120.123456;
    const packageEnd = duration + difference;
    port.duration = () => duration;
    let ready = false;
    const snapshot = { time: packageEnd, settings, sourceEnd: packageEnd };
    const recovery = restoreNativeOriginal(
      port,
      port.source(),
      snapshot,
      3,
      new AbortController().signal,
    ).then(() => {
      ready = true;
    });
    expect(port.seek).toHaveBeenCalledWith(duration);
    await Promise.resolve();
    expect(ready).toBe(false);
    finish(duration);
    await recovery;
    expect(snapshot.time).toBe(packageEnd);
    expect(port.setSource).not.toHaveBeenCalled();
  },
);

it.each([100.000002, NaN, Infinity])(
  'rejects an out-of-range recovery clock %s',
  async (time) => {
    const { port, settings } = make();
    await expect(
      restoreNativeOriginal(
        port,
        port.source(),
        { time, settings },
        3,
        new AbortController().signal,
      ),
    ).rejects.toThrow('NATIVE_ORIGINAL_DURATION');
    expect(port.seek).not.toHaveBeenCalled();
  },
);

it('reuses a pending identical seek when only the latest settings change, without acknowledging before the image is ready', async () => {
  const { port, settings, finish } = make();
  // Real HTML currentTime exposes the requested position before seeked.
  let requestedTime = 2;
  port.time = () => requestedTime;
  vi.mocked(port.seek).mockImplementation((time) => {
    requestedTime = time;
  });
  port.seeking = () => true;
  const first = new AbortController();
  const old = restoreNativeOriginal(
    port,
    port.source(),
    { time: 20, settings },
    3,
    first.signal,
  );
  const cancelled = expect(old).rejects.toThrow('NATIVE_ORIGINAL_CANCELLED');
  first.abort();
  await cancelled;
  let ready = false;
  const latest = restoreNativeOriginal(
    port,
    port.source(),
    { time: 20, settings: { ...settings, rate: 4 } },
    3,
    new AbortController().signal,
  ).then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(port.seek).toHaveBeenCalledTimes(1);
  expect(ready).toBe(false);
  port.seeking = () => false;
  finish(20);
  await latest;
  expect(port.restore).toHaveBeenLastCalledWith({ ...settings, rate: 4 }, 3);
});

it('captures the exact duration rejected by recovery without reading a later value', async () => {
  const { port, settings } = make();
  port.duration = vi
    .fn()
    .mockReturnValueOnce(120.123133)
    .mockReturnValue(120.123333);
  await expect(
    restoreNativeOriginal(
      port,
      port.source(),
      { time: 120.123333, settings },
      3,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({
    message: 'NATIVE_ORIGINAL_DURATION',
    recovery: {
      requestedTime: 120.123333,
      duration: 120.123133,
      durationKind: 0,
      readyState: 2,
      seeking: 0,
    },
  });
  expect(port.duration).toHaveBeenCalledTimes(1);
  expect(port.seek).not.toHaveBeenCalled();
});
