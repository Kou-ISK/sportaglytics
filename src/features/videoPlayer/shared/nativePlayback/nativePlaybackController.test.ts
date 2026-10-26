import { CachePlayerDurationError } from '../../components/PlaybackCache/cachePlayerDurationError';
import { afterEach, expect, it, vi } from 'vitest';
import { NativePlaybackController } from './nativePlaybackController';
import type {
  NativePlaybackIntent,
  NativePlaybackSnapshot,
  NativePlaybackClosed,
} from '../../../../types/ipc/nativePlayback';
const owner = { generation: 'one', sourceKey: 'a'.repeat(64) };
const drained: NativePlaybackClosed = {
  generation: 'one',
  nativeDrained: true,
  processStarted: true,
  processExited: true,
  pipesClosed: true,
  stopped: null,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const make = (
  presentation:
    | import('../../../../types/ipc/nativePlaybackPresentation').NativePlaybackPresentation
    | null = null,
) => {
  let listener: ((value: NativePlaybackSnapshot | null) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    listener = null;
  });
  let snapshot: NativePlaybackSnapshot = {
    intent: null,
    observation: null,
    lastConfirmedTime: 3,
    error: null,
    closing: false,
    closed: false,
  };
  const api = {
    onSnapshot: vi.fn(
      (_owner, callback: (value: NativePlaybackSnapshot | null) => void) => {
        listener = callback;
        return unsubscribe;
      },
    ),
    reportFailure: vi.fn(async () => {}),
    inspect: vi.fn(),
    open: vi.fn(async () => {}),
    apply: vi.fn(async (_v: NativePlaybackIntent) => {}),
    observe: vi.fn(async () => snapshot),
    close: vi.fn(async () => ({
      ...drained,
      stopped: snapshot.observation
        ? {
            ...owner,
            sequence: snapshot.observation.sequence,
            seekId: snapshot.observation.seekId,
            time: snapshot.lastConfirmedTime,
            rate: 0 as const,
          }
        : null,
    })),
  };
  const original = {
    pause: vi.fn(),
    restore: vi.fn(
      async (
        _time: number,
        _controls: import('./nativePlaybackController').NativePlaybackControls,
        _signal: AbortSignal,
      ) => {},
    ),
    release: vi.fn(),
    restored: vi.fn(),
  };
  const controller = new NativePlaybackController(
    api,
    owner,
    'file:///synthetic.mp4',
    3,
    { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true },
    original,
    presentation,
  );
  return {
    controller,
    unsubscribe,
    api,
    original,
    failMedia: () => listener?.({ ...snapshot, error: 'media', closing: true }),
    buffering: (
      sequence: number,
      seekId: number,
      time: number,
      revision: number,
    ) => {
      if (!snapshot.observation) throw Error('ready observation required');
      snapshot = {
        ...snapshot,
        observation: {
          ...snapshot.observation,
          sequence,
          seekId,
          time,
          revision,
          phase: 'buffering',
          rate: 0,
          videoReady: false,
          audioReady: false,
        },
      };
      listener?.(snapshot);
    },
    reply: (
      sequence: number,
      seekId: number,
      time: number,
      revision = sequence,
      playing = false,
      ready = true,
    ) => {
      snapshot = {
        ...snapshot,
        lastConfirmedTime: ready ? time : snapshot.lastConfirmedTime,
        observation: {
          ...owner,
          revision,
          sequence,
          seekId,
          time,
          phase: ready ? (playing ? 'playing' : 'paused') : 'seeking',
          rate: playing ? 1 : 0,
          audioTrack: 0,
          volume: 0.5,
          muted: true,
          videoReady: ready,
          audioReady: ready,
          error: null,
        },
      };
      listener?.(snapshot);
    },
  };
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('keeps the native owner across a short stopped refill without acknowledging a seek or extrapolating', async () => {
  vi.useFakeTimers();
  const { controller, api, reply, buffering } = make();
  await vi.advanceTimersByTimeAsync(10);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.2, 2, true);
  buffering(2, 1, 3.205, 3);
  expect(controller.snapshot().phase).toBe('active');
  expect(controller.snapshot().time).toBe(3.2);
  expect(controller.requestedControls.playing).toBe(true);
  await vi.advanceTimersByTimeAsync(200);
  reply(2, 1, 3.21, 4, true);
  expect(controller.snapshot().time).toBe(3.21);
  expect(api.open).toHaveBeenCalledTimes(1);
  expect(api.close).not.toHaveBeenCalled();
  await controller.returnToOriginal();
});
it('does not let buffering heartbeats or volume changes hide a persistent refill timeout', async () => {
  vi.useFakeTimers();
  const { controller, reply, buffering } = make();
  await vi.advanceTimersByTimeAsync(10);
  reply(1, 1, 3);
  buffering(1, 1, 3, 2);
  for (let i = 0; i < 4; i++) {
    await vi.advanceTimersByTimeAsync(1000);
    controller.controls({ volume: 0.6 + i * 0.01 });
    await vi.advanceTimersByTimeAsync(1);
    buffering(i + 2, 1, 3, i + 3);
  }
  await vi.advanceTimersByTimeAsync(1250);
  expect(controller.snapshot().error).toBe('NATIVE_RESPONSE_TIMEOUT');
  await controller.returnToOriginal().catch(() => {});
});
it('cancels the refill deadline for a new seek but ignores an old buffered observation', async () => {
  vi.useFakeTimers();
  const { controller, reply, buffering } = make();
  await vi.advanceTimersByTimeAsync(10);
  reply(1, 1, 3);
  buffering(1, 1, 3, 2);
  await vi.advanceTimersByTimeAsync(4000);
  controller.seek(4);
  await vi.advanceTimersByTimeAsync(1);
  buffering(1, 1, 3, 3);
  reply(2, 2, 4, 4);
  await vi.advanceTimersByTimeAsync(1500);
  expect(controller.snapshot().phase).toBe('active');
  expect(controller.snapshot().time).toBe(4);
  await controller.returnToOriginal();
});
it('does not extrapolate time or turn observed playback into seek commands', async () => {
  vi.useFakeTimers();
  const { controller, api, reply } = make();
  await vi.advanceTimersByTimeAsync(10);
  reply(1, 1, 3);
  await vi.advanceTimersByTimeAsync(34);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.2, 2, true);
  await vi.advanceTimersByTimeAsync(100);
  expect(controller.snapshot().time).toBe(3.2);
  expect(api.apply).toHaveBeenCalledTimes(2);
  controller.controls({ playing: false });
  controller.seek(4);
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.5, 3, true);
  await vi.advanceTimersByTimeAsync(34);
  expect(controller.snapshot().time).toBe(3.2);
  reply(4, 2, 4, 4);
  await vi.advanceTimersByTimeAsync(34);
  expect(controller.snapshot().time).toBe(4);
  await controller.returnToOriginal();
});
it('coalesces a held IPC writer and never treats its receipt as seek readiness', async () => {
  vi.useFakeTimers();
  const { controller, api } = make();
  const pending = deferred<void>();
  api.apply.mockReturnValueOnce(pending.promise);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(4);
  controller.seek(2);
  controller.seek(5);
  expect(api.apply).toHaveBeenCalledTimes(1);
  expect(controller.hasConfirmedSeek).toBe(false);
  pending.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(api.apply.mock.calls.map(([v]) => v.targetTime)).toEqual([3, 5]);
  await controller.returnToOriginal();
});
it('keeps a pending stopped seek when pointer release repeats the same target', async () => {
  vi.useFakeTimers();
  const { controller, api, reply } = make();
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.seek(4000);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(4000);
  controller.seek(4000);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.apply).toHaveBeenCalledTimes(2);
  expect(controller.snapshot().time).toBe(3);
  expect(controller.hasConfirmedSeek).toBe(false);
  reply(2, 2, 4000);
  expect(controller.hasConfirmedSeek).toBe(true);
  controller.seek(4000); // A completed seek remains a distinct new operation.
  await vi.advanceTimersByTimeAsync(1);
  expect(api.apply).toHaveBeenLastCalledWith(
    expect.objectContaining({ sequence: 3, seekId: 3, targetTime: 4000 }),
  );
  await controller.returnToOriginal();
});
it('keeps latest different targets and does not coalesce a playing seek', async () => {
  vi.useFakeTimers();
  const { controller, api, reply } = make();
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  for (const time of [4000, 4100, 4000]) {
    controller.seek(time);
    await vi.advanceTimersByTimeAsync(1);
  }
  expect(api.apply.mock.calls.map(([value]) => value.targetTime)).toEqual([
    3, 4000, 4100, 4000,
  ]);
  reply(2, 2, 4000);
  expect(controller.hasConfirmedSeek).toBe(false);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(4000);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.apply).toHaveBeenLastCalledWith(
    expect.objectContaining({ sequence: 6, seekId: 5, playing: true }),
  );
  await controller.returnToOriginal();
});
it('does not extend the pending seek deadline with identical pointer releases', async () => {
  vi.useFakeTimers();
  const { controller, reply } = make();
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.seek(4000);
  await vi.advanceTimersByTimeAsync(4000);
  reply(2, 2, 4000, 2, false, false); // Native is alive but the image is not ready.
  controller.seek(4000);
  await vi.advanceTimersByTimeAsync(1250);
  expect(controller.snapshot().error).toBe('NATIVE_RESPONSE_TIMEOUT');
  expect(controller.snapshot().time).toBe(3);
  await controller.returnToOriginal();
});
it('retains authority through native drain and stopped original frame/audio recovery', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make();
  await vi.advanceTimersByTimeAsync(1);
  const close = deferred<typeof drained>();
  api.close.mockReturnValue(close.promise);
  const restore = deferred<void>();
  original.restore.mockReturnValue(restore.promise);
  const work = controller.returnToOriginal();
  await vi.advanceTimersByTimeAsync(1);
  expect(original.restore).not.toHaveBeenCalled();
  expect(original.release).not.toHaveBeenCalled();
  close.resolve(drained);
  await vi.advanceTimersByTimeAsync(1);
  expect(original.restore).toHaveBeenCalledWith(
    3,
    expect.objectContaining({ playing: false, audioTrack: 0 }),
    expect.any(AbortSignal),
  );
  expect(original.release).not.toHaveBeenCalled();
  restore.resolve();
  await work;
  expect(original.release).toHaveBeenCalledTimes(1);
});

it('a responsive Main with no native ACK still times out', async () => {
  vi.useFakeTimers();
  const { controller, api } = make();
  await vi.advanceTimersByTimeAsync(5500);
  expect(api.observe).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().error).toBe('NATIVE_RESPONSE_TIMEOUT');
  await controller.returnToOriginal();
});
it('does not release authority for late restore after Session cancellation; recovery is single-owner', async () => {
  vi.useFakeTimers();
  const { controller, original } = make();
  await vi.advanceTimersByTimeAsync(1);
  const restore = deferred<void>();
  original.restore.mockReturnValue(restore.promise);
  const work = controller.returnToOriginal();
  const rejected = expect(work).rejects.toThrow();
  expect(controller.returnToOriginal()).toBe(work);
  await vi.advanceTimersByTimeAsync(1);
  controller.fail('NATIVE_SOURCE_CHANGED');
  restore.resolve();
  await rejected;
  expect(original.restore).toHaveBeenCalledTimes(1);
  expect(original.release).not.toHaveBeenCalled();
});
it('sends close while open is still pending and never issues a late media command', async () => {
  vi.useFakeTimers();
  const { controller, api } = make();
  const opening = deferred<void>();
  api.open.mockReturnValue(opening.promise);
  await vi.advanceTimersByTimeAsync(1);
  const work = controller.returnToOriginal();
  await vi.advanceTimersByTimeAsync(1);
  expect(api.close).toHaveBeenCalledTimes(1);
  expect(api.apply).not.toHaveBeenCalled();
  opening.resolve();
  await work;
  expect(api.apply).not.toHaveBeenCalled();
});

it('does not issue a late open when the event loop has delayed the watchdog', async () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { controller, api } = make();
  now = 5001;
  await Promise.resolve();
  await Promise.resolve();
  expect(api.open).not.toHaveBeenCalled();
  expect(controller.snapshot().phase).toBe('failed');
  await controller.returnToOriginal();
});
it('does not issue a queued command after the fixed readiness deadline', async () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { controller, api } = make();
  const write = deferred<void>();
  api.apply.mockReturnValueOnce(write.promise);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(4);
  now = 5001;
  write.resolve();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(api.apply).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().phase).toBe('failed');
  await controller.returnToOriginal();
});
it('rejects a ready ACK received past deadline before a watchdog timer ran', async () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { controller, api } = make();
  const poll = deferred<NativePlaybackSnapshot>();
  api.observe.mockReturnValueOnce(poll.promise);
  await vi.advanceTimersByTimeAsync(1);
  now = 5001;
  poll.resolve({
    intent: null,
    lastConfirmedTime: 3,
    error: null,
    closing: false,
    closed: false,
    observation: {
      ...owner,
      revision: 1,
      sequence: 1,
      seekId: 1,
      phase: 'paused',
      time: 3,
      rate: 0,
      audioTrack: 0,
      volume: 0.5,
      muted: true,
      videoReady: true,
      audioReady: true,
      error: null,
    },
  });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(controller.snapshot().phase).toBe('failed');
  expect(controller.hasConfirmedSeek).toBe(false);
  await controller.returnToOriginal();
});
it.each(['close', 'restore'] as const)(
  'does not acknowledge fallback after %s failure',
  async (where) => {
    vi.useFakeTimers();
    const { controller, api, original } = make();
    await vi.advanceTimersByTimeAsync(1);
    if (where === 'close')
      api.close.mockResolvedValue({ ...drained, processExited: false });
    else
      original.restore.mockRejectedValue(Error('audio selection not restored'));
    await expect(controller.returnToOriginal()).rejects.toThrow(
      'NATIVE_RECOVERY_UNCONFIRMED',
    );
    expect(original.release).not.toHaveBeenCalled();
  },
);
it('timeout requests close once but retains ownership and ignores late observation', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make();
  const poll = deferred<NativePlaybackSnapshot>();
  api.observe.mockReturnValue(poll.promise);
  await vi.advanceTimersByTimeAsync(5500);
  expect(controller.snapshot().phase).toBe('failed');
  expect(api.close).toHaveBeenCalledTimes(1);
  expect(original.release).not.toHaveBeenCalled();
  poll.resolve({
    intent: null,
    observation: null,
    lastConfirmedTime: 9,
    error: null,
    closing: false,
    closed: false,
  });
  await vi.advanceTimersByTimeAsync(50);
  expect(controller.snapshot().time).toBe(3);
  await controller.returnToOriginal();
});

it.each(['fail', 'close', 'restore'] as const)(
  'still drains native when the original pause throws during %s',
  async (operation) => {
    vi.useFakeTimers();
    const { controller, api, original } = make();
    await vi.advanceTimersByTimeAsync(1);
    original.pause.mockImplementation(() => {
      throw Error('HTML player disposed');
    });
    if (operation === 'fail')
      expect(() => controller.fail('NATIVE_SOURCE_CHANGED')).not.toThrow();
    else if (operation === 'close') await controller.closeNative();
    else
      await expect(controller.returnToOriginal()).rejects.toThrow(
        'NATIVE_RECOVERY_UNCONFIRMED',
      );
    await vi.advanceTimersByTimeAsync(1);
    expect(api.close).toHaveBeenCalledOnce();
    expect(original.release).not.toHaveBeenCalled();
    expect(original.restore).not.toHaveBeenCalled();
    expect(controller.snapshot().phase).toBe('failed');
  },
);
it('ignores a stale observe rejection while stopped original restoration is pending', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make();
  const poll = Promise.withResolvers<NativePlaybackSnapshot>();
  const restore = Promise.withResolvers<void>();
  api.observe.mockReturnValueOnce(poll.promise);
  original.restore.mockReturnValueOnce(restore.promise);
  await vi.advanceTimersByTimeAsync(1);
  const work = controller.returnToOriginal();
  await vi.advanceTimersByTimeAsync(1);
  expect(original.restore).toHaveBeenCalledOnce();
  poll.reject(Error('NATIVE_OWNER_CHANGED'));
  await vi.advanceTimersByTimeAsync(1);
  expect(controller.snapshot().phase).toBe('closing');
  restore.resolve();
  await work;
  expect(controller.snapshot().phase).toBe('original');
  expect(original.release).toHaveBeenCalledOnce();
});

it('accepts pushed clock updates without advancing any Renderer timer and unsubscribes on drain', async () => {
  vi.useFakeTimers();
  const { controller, api, reply, unsubscribe } = make();
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  reply(2, 1, 3.4, 2, true);
  expect(controller.snapshot().time).toBe(3.4);
  expect(api.observe).toHaveBeenCalledTimes(1);
  await controller.closeNative();
  expect(unsubscribe).toHaveBeenCalledOnce();
  reply(2, 1, 9, 3, true);
  expect(controller.snapshot().time).toBe(3.4);
});

it('a detached snapshot subscription cannot block native drain', async () => {
  vi.useFakeTimers();
  const { controller, api, unsubscribe } = make();
  await vi.advanceTimersByTimeAsync(1);
  unsubscribe.mockImplementationOnce(() => {
    throw Error('detached preload');
  });
  await controller.closeNative();
  expect(api.close).toHaveBeenCalledOnce();
});

it.each(['fail', 'close', 'restore', 'snapshot'] as const)(
  'a throwing UI subscriber cannot skip native drain during %s',
  async (operation) => {
    vi.useFakeTimers();
    const { controller, api, reply } = make();
    await vi.advanceTimersByTimeAsync(1);
    controller.subscribe(() => {
      throw Error('UI listener failed');
    });
    if (operation === 'fail') controller.fail('test');
    else if (operation === 'close') await controller.closeNative();
    else if (operation === 'restore') await controller.returnToOriginal();
    else reply(1, 1, 3);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(api.close).toHaveBeenCalledOnce();
  },
);

const presentation = {
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
};
it.each(['pause', 'seek'] as const)(
  'preserves the operation which first detects an expired refill: %s',
  async (operation) => {
    vi.useFakeTimers();
    const { controller, api, original, reply, buffering } = make(presentation);
    await vi.advanceTimersByTimeAsync(1);
    reply(1, 1, 3);
    controller.controls({ playing: true });
    await vi.advanceTimersByTimeAsync(1);
    reply(2, 1, 3.2, 2, true);
    buffering(2, 1, 3.205, 3);
    api.close.mockResolvedValue({
      ...drained,
      stopped: { ...owner, sequence: 2, seekId: 1, time: 3.205, rate: 0 },
    });
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5001);
    if (operation === 'pause') controller.controls({ playing: false });
    else controller.seek(5);
    await controller.returnToOriginal();
    expect(original.restored).toHaveBeenCalledWith(
      operation === 'pause' ? 3.205 : 5,
      expect.objectContaining({ playing: operation !== 'pause' }),
    );
    expect(original.release).toHaveBeenCalledOnce();
  },
);
it.each(['snapshot-first', 'watchdog-first', 'late-ready'] as const)(
  'converges expired refill through verified original restoration: %s',
  async (order) => {
    vi.useFakeTimers();
    const { controller, api, original, reply, buffering, failMedia } =
      make(presentation);
    await vi.advanceTimersByTimeAsync(1);
    reply(1, 1, 3);
    controller.controls({ playing: true });
    await vi.advanceTimersByTimeAsync(1);
    reply(2, 1, 3.2, 2, true);
    buffering(2, 1, 3.205, 3);
    api.close.mockResolvedValue({
      ...drained,
      stopped: { ...owner, sequence: 2, seekId: 1, time: 3.205, rate: 0 },
    });
    if (order === 'watchdog-first') {
      await vi.advanceTimersByTimeAsync(5250);
      failMedia();
    } else {
      vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5001);
      if (order === 'snapshot-first') failMedia();
      else reply(2, 1, 4, 4, true); // too late: never accept new ready time
    }
    await controller.returnToOriginal();
    expect(controller.snapshot().phase).toBe('original');
    expect(api.close).toHaveBeenCalledOnce();
    expect(original.restored).toHaveBeenCalledWith(
      3.205,
      expect.objectContaining({ playing: true }),
    );
    expect(original.release).toHaveBeenCalledOnce();
  },
);
it.each(['cleanup', 'stop-clock'] as const)(
  'retains ownership when expired refill cannot verify %s',
  async (bad) => {
    vi.useFakeTimers();
    const { controller, api, original, reply, buffering } = make(presentation);
    await vi.advanceTimersByTimeAsync(1);
    reply(1, 1, 3);
    buffering(1, 1, 3.205, 2);
    api.close.mockResolvedValue({
      ...drained,
      nativeDrained: bad !== 'cleanup',
      stopped: {
        ...owner,
        sequence: 1,
        seekId: 1,
        time: bad === 'stop-clock' ? 3.2 : 3.205,
        rate: 0,
      },
    });
    await vi.advanceTimersByTimeAsync(5250);
    await controller.returnToOriginal().catch(() => {});
    expect(controller.snapshot().phase).toBe('failed');
    expect(original.restore).not.toHaveBeenCalled();
    expect(original.release).not.toHaveBeenCalled();
  },
);
it('retains ownership if committing recovered UI synchronously unmounts it', async () => {
  const { controller, original } = make(presentation);
  original.restored.mockImplementation(() => controller.fail('UNMOUNTED'));
  await expect(controller.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  expect(original.release).not.toHaveBeenCalled();
  expect(controller.snapshot().phase).toBe('failed');
});
it('restores a newer seek issued while committing the recovered UI before release', async () => {
  vi.useFakeTimers();
  const { controller, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  original.restored.mockImplementationOnce(() => controller.seek(25));
  controller.controls({ rate: 6 });
  await controller.returnToOriginal();
  expect(original.restore.mock.calls.map(([time]) => time)).toEqual([3, 25]);
  expect(controller.snapshot().time).toBe(25);
  expect(original.release).toHaveBeenCalledTimes(1);
});
it('holds unsupported operations until native drain, then restores the latest original time and controls', async () => {
  vi.useFakeTimers();
  const { controller, api, original, reply } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.2, 2, true);
  const close = deferred<typeof drained>();
  api.close.mockReturnValue(close.promise);
  controller.controls({ rate: 6 });
  controller.seek(13.123);
  controller.controls({
    audioTrack: 2,
    muted: false,
    volume: 0.3,
    playing: false,
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(api.apply.mock.calls.map(([v]) => v.rate)).toEqual([1, 1]);
  expect(original.restore).not.toHaveBeenCalled();
  expect(original.release).not.toHaveBeenCalled();
  close.resolve({
    ...drained,
    stopped: { ...owner, sequence: 2, seekId: 1, time: 3.25, rate: 0 },
  });
  await controller.returnToOriginal();
  expect(original.restore).toHaveBeenCalledTimes(1);
  expect(original.restore).toHaveBeenCalledWith(
    13.123,
    {
      playing: false,
      rate: 6,
      audioTrack: 2,
      volume: 0.3,
      muted: false,
    },
    expect.any(AbortSignal),
  );
  expect(original.restored).toHaveBeenCalledWith(13.123, {
    playing: false,
    rate: 6,
    audioTrack: 2,
    volume: 0.3,
    muted: false,
  });
  expect(original.restored.mock.invocationCallOrder[0]).toBeLessThan(
    original.release.mock.invocationCallOrder[0],
  );
});
it('restores a newer operation received during original recovery before allowing playback', async () => {
  vi.useFakeTimers();
  const { controller, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  const restore = deferred<void>();
  original.restore.mockReturnValueOnce(restore.promise);
  controller.seek(40.123);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(55.123);
  controller.controls({ playing: true });
  expect(original.release).not.toHaveBeenCalled();
  restore.resolve();
  await controller.returnToOriginal();
  expect(original.restore.mock.calls).toHaveLength(2);
  expect(original.restore).toHaveBeenLastCalledWith(
    55.123,
    expect.objectContaining({ playing: false }),
    expect.any(AbortSignal),
  );
  expect(original.restored).toHaveBeenCalledWith(
    55.123,
    expect.objectContaining({ playing: true }),
  );
});
it('retains the HTML lease and does not restore when fallback drain is unconfirmed', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  api.close.mockResolvedValue({ ...drained, processExited: false });
  controller.controls({ muted: false });
  await expect(controller.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  expect(original.restore).not.toHaveBeenCalled();
  expect(original.release).not.toHaveBeenCalled();
});
it('routes a non-grid frame request to the original without rounding it', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(3.017);
  await controller.returnToOriginal();
  expect(api.apply.mock.calls.map(([v]) => v.targetTime)).toEqual([3]);
  expect(original.restore).toHaveBeenCalledWith(
    3.017,
    expect.anything(),
    expect.any(AbortSignal),
  );
});

it('cancels superseded restore and ignores its rejection while preserving the latest operation', async () => {
  vi.useFakeTimers();
  const { controller, api, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  const old = Promise.withResolvers<void>();
  original.restore.mockReturnValueOnce(old.promise);
  controller.seek(40);
  await vi.advanceTimersByTimeAsync(1);
  const previousSignal = original.restore.mock.calls[0]?.[2];
  controller.seek(41.123);
  controller.controls({ rate: 6, audioTrack: 2 });
  expect(previousSignal?.aborted).toBe(true);
  old.reject(Error('superseded seek timeout'));
  await controller.returnToOriginal();
  expect(api.close).toHaveBeenCalledTimes(1);
  expect(original.restore).toHaveBeenLastCalledWith(
    41.123,
    expect.objectContaining({ rate: 6, audioTrack: 2 }),
    expect.any(AbortSignal),
  );
  expect(original.release).toHaveBeenCalledTimes(1);
});

it('finishes an in-flight original image during a drag and keeps the latest target pending', async () => {
  vi.useFakeTimers();
  const { controller, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  const first = deferred<void>();
  const latest = deferred<void>();
  original.restore
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  controller.seek(40);
  await vi.advanceTimersByTimeAsync(1);
  const signal = original.restore.mock.calls[0]![2];
  controller.seek(41);
  controller.seek(42);
  expect(signal.aborted).toBe(false);
  expect(original.restore).toHaveBeenCalledTimes(1);
  first.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(controller.snapshot()).toMatchObject({
    phase: 'closing',
    time: 40,
    originalPreviewTime: 40,
  });
  expect(controller.seekCommandTime).toBe(42);
  expect(original.restore.mock.calls.map(([time]) => time)).toEqual([40, 42]);
  expect(original.restore.mock.calls[1]![1].playing).toBe(false);
  expect(original.restored).not.toHaveBeenCalled();
  expect(original.release).not.toHaveBeenCalled();
  latest.resolve();
  await controller.returnToOriginal();
  expect(controller.snapshot()).toMatchObject({ phase: 'original', time: 42 });
  expect(original.release).toHaveBeenCalledOnce();
});

it.each([
  'NATIVE_SOURCE_CHANGED',
  'NATIVE_ORIGINAL_MEDIA_ERROR',
  'NATIVE_ORIGINAL_TIMEOUT',
])(
  'does not hide a real %s when a later fallback seek is pending',
  async (reason) => {
    vi.useFakeTimers();
    const { controller, original } = make(presentation);
    await vi.advanceTimersByTimeAsync(1);
    const first = Promise.withResolvers<void>();
    original.restore.mockReturnValueOnce(first.promise);
    controller.seek(40);
    await vi.advanceTimersByTimeAsync(1);
    controller.seek(42);
    const failed = expect(controller.returnToOriginal()).rejects.toThrow(
      'NATIVE_RECOVERY_UNCONFIRMED',
    );
    first.reject(Error(reason));
    await failed;
    expect(controller.snapshot()).toMatchObject({
      phase: 'failed',
      time: 3,
      originalPreviewTime: null,
    });
    expect(original.restore).toHaveBeenCalledTimes(1);
    expect(original.release).not.toHaveBeenCalled();
  },
);

it('never publishes an original image from an attempt cancelled by changed controls', async () => {
  vi.useFakeTimers();
  const { controller, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  const first = deferred<void>();
  const latest = deferred<void>();
  original.restore
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  controller.seek(40);
  await vi.advanceTimersByTimeAsync(1);
  const signal = original.restore.mock.calls[0]![2];
  controller.seek(42);
  controller.controls({ audioTrack: 2 });
  expect(signal.aborted).toBe(true);
  first.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(controller.snapshot()).toMatchObject({
    phase: 'closing',
    time: 3,
    originalPreviewTime: null,
  });
  expect(original.release).not.toHaveBeenCalled();
  latest.resolve();
  await controller.returnToOriginal();
  expect(original.restored).toHaveBeenCalledWith(
    42,
    expect.objectContaining({ audioTrack: 2 }),
  );
});

it('retains the last verified preview and ownership after global cancellation during a later seek', async () => {
  vi.useFakeTimers();
  const { controller, original } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  const first = deferred<void>();
  const latest = deferred<void>();
  original.restore
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  controller.seek(40);
  await vi.advanceTimersByTimeAsync(1);
  controller.seek(42);
  first.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(controller.snapshot().originalPreviewTime).toBe(40);
  const failed = expect(controller.returnToOriginal()).rejects.toThrow();
  controller.fail('NATIVE_SOURCE_CHANGED');
  expect(original.restore.mock.calls[1]![2].aborted).toBe(true);
  latest.resolve();
  await failed;
  expect(controller.snapshot()).toMatchObject({
    phase: 'failed',
    time: 40,
    originalPreviewTime: 40,
  });
  expect(original.restored).not.toHaveBeenCalled();
  expect(original.release).not.toHaveBeenCalled();
});

it('restores the measured stopped clock after a media failure, preserving the latest requested controls', async () => {
  vi.useFakeTimers();
  const { controller, api, original, reply, failMedia } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.2, 2, true);
  const close = deferred<NativePlaybackClosed>();
  api.close.mockReturnValue(close.promise);
  failMedia();
  await vi.advanceTimersByTimeAsync(1);
  expect(original.restore).not.toHaveBeenCalled();
  controller.controls({ rate: 6, playing: false });
  close.resolve({
    ...drained,
    stopped: { ...owner, sequence: 2, seekId: 1, time: 3.266, rate: 0 },
  });
  await controller.returnToOriginal();
  expect(original.restored).toHaveBeenCalledWith(
    3.266,
    expect.objectContaining({ rate: 6, playing: false }),
  );
  expect(original.release).toHaveBeenCalledOnce();
});
it('waits for a stopped backend window endpoint rather than predicting it from running notifications', async () => {
  vi.useFakeTimers();
  const { controller, api, original, reply } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 19.5, 2, true);
  expect(api.close).not.toHaveBeenCalled();
  reply(2, 1, 19.505, 3, false);
  await controller.returnToOriginal();
  expect(original.restored).toHaveBeenCalledWith(
    19.505,
    expect.objectContaining({ playing: true }),
  );
});
it.each(['missing', 'regressed', 'different-source', 'future-seek'])(
  'holds original ownership when the final stop is %s',
  async (fault) => {
    vi.useFakeTimers();
    const { controller, api, original, reply } = make(presentation);
    await vi.advanceTimersByTimeAsync(1);
    reply(1, 1, 3);
    const stopped = {
      ...owner,
      sequence: 1,
      seekId: 1,
      time: 3,
      rate: 0 as const,
    };
    if (fault === 'regressed') stopped.time = 2.9;
    if (fault === 'different-source') stopped.sourceKey = 'b'.repeat(64);
    if (fault === 'future-seek') {
      stopped.sequence = 2;
      stopped.seekId = 2;
    }
    api.close.mockResolvedValue({
      ...drained,
      stopped: fault === 'missing' ? null : stopped,
    });
    await expect(controller.returnToOriginal()).rejects.toThrow(
      'NATIVE_RECOVERY_UNCONFIRMED',
    );
    expect(original.restore).not.toHaveBeenCalled();
    expect(original.release).not.toHaveBeenCalled();
  },
);

it('hands a user pause at the native window endpoint to original without restarting playback', async () => {
  vi.useFakeTimers();
  const { controller, api, original, reply } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 19.49, 2, true);
  controller.controls({ playing: false });
  await vi.advanceTimersByTimeAsync(1);
  reply(3, 1, 19.505, 3, false);
  await controller.returnToOriginal();
  expect(original.restored).toHaveBeenCalledWith(
    19.505,
    expect.objectContaining({ playing: false }),
  );
  expect(api.apply).toHaveBeenCalledTimes(3);
});
it('keeps a newer explicit seek when media failure stops the earlier processed native command', async () => {
  vi.useFakeTimers();
  const { controller, api, original, reply, failMedia } = make(presentation);
  await vi.advanceTimersByTimeAsync(1);
  reply(1, 1, 3);
  controller.controls({ playing: true });
  await vi.advanceTimersByTimeAsync(1);
  reply(2, 1, 3.2, 2, true);
  controller.seek(5);
  await vi.advanceTimersByTimeAsync(1);
  api.close.mockResolvedValue({
    ...drained,
    stopped: { ...owner, sequence: 2, seekId: 1, time: 3.266, rate: 0 },
  });
  failMedia();
  await controller.returnToOriginal();
  expect(original.restored).toHaveBeenCalledWith(
    5,
    expect.objectContaining({ playing: true }),
  );
});

it('keeps relative command position separate until the latest seek is confirmed', async () => {
  vi.useFakeTimers();
  const f = make();
  try {
    await vi.advanceTimersByTimeAsync(1);
    f.reply(1, 1, 3);
    f.controller.seek(20);
    expect(f.controller.seekCommandTime).toBe(20);
    expect(f.controller.snapshot().time).toBe(3);
    f.controller.seek(30);
    f.reply(2, 2, 20);
    expect(f.controller.seekCommandTime).toBe(30);
    expect(f.controller.snapshot().time).toBe(3);
    f.reply(3, 3, 30);
    expect(f.controller.seekCommandTime).toBe(30);
    f.controller.controls({ playing: true });
    f.reply(4, 3, 30.5, 4, true);
    expect(f.controller.seekCommandTime).toBe(30.5);
    expect(f.controller.snapshot().time).toBe(30.5);
  } finally {
    await f.controller.returnToOriginal();
  }
});

it('records recovery failure after clean native drain without leaking error text', async () => {
  const { controller, api, original } = make();
  await new Promise((resolve) => setTimeout(resolve, 0));
  original.restore.mockRejectedValueOnce(Error('NATIVE_ORIGINAL_DURATION'));
  await expect(controller.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  expect(api.close).toHaveBeenCalledTimes(1);
  expect(api.reportFailure).toHaveBeenCalledWith(owner, {
    stage: 2,
    code: 26,
    sequence: 1,
    seekId: 1,
    targetTime: 3,
    confirmedTime: 3,
  });
  expect(original.release).not.toHaveBeenCalled();
});

it('unknown private error text and rejected diagnostics cannot change recovery ownership', async () => {
  const { controller, api, original } = make();
  await new Promise((resolve) => setTimeout(resolve, 0));
  api.reportFailure.mockRejectedValue(Error('optional sink'));
  original.restore.mockRejectedValueOnce(
    Error('private source path or message'),
  );
  await expect(controller.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  expect(api.reportFailure).toHaveBeenCalledWith(
    owner,
    expect.objectContaining({ code: 0 }),
  );
  expect(JSON.stringify(api.reportFailure.mock.calls)).not.toContain('private');
  expect(original.release).not.toHaveBeenCalled();
});

it('forwards numeric duration evidence from the failed recovery snapshot', async () => {
  const { controller, api, original } = make();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const failure = new CachePlayerDurationError(
    'NATIVE_ORIGINAL_DURATION',
    120.123333,
    120.123133,
    2,
    false,
  );
  original.restore.mockRejectedValueOnce(failure);
  await expect(controller.returnToOriginal()).rejects.toThrow(
    'NATIVE_RECOVERY_UNCONFIRMED',
  );
  expect(api.reportFailure).toHaveBeenCalledWith(
    owner,
    expect.objectContaining({ recovery: failure.recovery }),
  );
  expect(original.release).not.toHaveBeenCalled();
});
