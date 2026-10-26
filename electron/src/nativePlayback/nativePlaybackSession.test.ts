import { describe, expect, it, vi } from 'vitest';
import { NativePlaybackSession } from './nativePlaybackSession';
import type {
  NativePlaybackIntent,
  NativePlaybackClosed,
  NativePlaybackObservation,
} from '../../../src/types/ipc/nativePlayback';

const owner = { generation: 'session-1', sourceKey: 'a'.repeat(64) };
const intent = (
  changes: Partial<NativePlaybackIntent> = {},
): NativePlaybackIntent => ({
  ...owner,
  sequence: 1,
  seekId: 1,
  targetTime: 3,
  playing: false,
  rate: 1,
  audioTrack: 0,
  volume: 0.5,
  muted: true,
  ...changes,
});
const observation = (
  changes: Partial<NativePlaybackObservation> = {},
): NativePlaybackObservation => ({
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
  ...changes,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const drained: NativePlaybackClosed = {
  generation: owner.generation,
  nativeDrained: true,
  processStarted: true,
  processExited: true,
  pipesClosed: true,
  stopped: null,
};
const make = () => {
  const backend = {
    write: vi.fn(async (_value: NativePlaybackIntent) => {}),
    close: vi.fn(async () => drained),
  };
  const session = new NativePlaybackSession(
    { owner, start: 0, end: 10, audioTracks: 3, rates: [1] },
    backend,
  );
  return { session, backend };
};
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('native playback Main ownership', () => {
  it('coalesces commands and ignores stale seek/clock replies without observing delivery as readiness', async () => {
    const { session, backend } = make();
    const write = deferred<void>();
    backend.write.mockImplementationOnce(() => write.promise);
    session.apply(intent());
    await tick();
    session.apply(intent({ sequence: 2, seekId: 2, targetTime: 4 }));
    session.apply(intent({ sequence: 3, seekId: 3, targetTime: 2 }));
    expect(backend.write).toHaveBeenCalledTimes(1);
    expect(session.observe(observation())).toBe(false);
    expect(session.snapshot().lastConfirmedTime).toBe(0);
    write.resolve();
    await tick();
    expect(backend.write.mock.calls.map(([v]) => v.sequence)).toEqual([1, 3]);
    expect(
      session.observe(
        observation({ revision: 2, sequence: 3, seekId: 3, time: 2 }),
      ),
    ).toBe(true);
    expect(session.snapshot().lastConfirmedTime).toBe(2);
  });
  it('uses the native clock after a stopped seek ACK and rejects a late resume after pause', async () => {
    const { session } = make();
    session.apply(intent());
    await tick();
    session.observe(observation());
    session.apply(intent({ sequence: 2, playing: true }));
    await tick();
    expect(
      session.observe(
        observation({
          revision: 2,
          sequence: 2,
          phase: 'playing',
          time: 3.25,
          rate: 1,
        }),
      ),
    ).toBe(true);
    session.apply(intent({ sequence: 3 }));
    await tick();
    expect(
      session.observe(
        observation({
          revision: 3,
          sequence: 2,
          phase: 'playing',
          time: 3.5,
          rate: 1,
        }),
      ),
    ).toBe(false);
    expect(
      session.observe(observation({ revision: 4, sequence: 3, time: 3.4 })),
    ).toBe(true);
    expect(session.snapshot().lastConfirmedTime).toBe(3.4);
  });
  it.each([
    'wrong-anchor',
    'early-playing',
    'wrong-audio',
    'future-sequence',
  ] as const)('fails closed for %s', async (kind) => {
    const { session, backend } = make();
    session.apply(intent());
    await tick();
    const values = {
      'wrong-anchor': { time: 3.01 },
      'early-playing': { phase: 'playing' as const, rate: 1 },
      'wrong-audio': { audioTrack: 1 },
      'future-sequence': { sequence: 2 },
    };
    expect(session.observe(observation(values[kind]))).toBe(false);
    await tick();
    expect(session.snapshot().error).toBe('protocol');
    expect(backend.close).toHaveBeenCalledTimes(1);
  });
  it.each(['paused', 'playing'] as const)(
    'rejects an in-scope %s clock regression in the same seek and retains confirmed time',
    async (phase) => {
      const { session, backend } = make();
      session.apply(intent());
      await tick();
      session.observe(observation());
      session.apply(intent({ sequence: 2, playing: true }));
      await tick();
      expect(
        session.observe(
          observation({
            revision: 2,
            sequence: 2,
            phase: 'playing',
            rate: 1,
            time: 4,
          }),
        ),
      ).toBe(true);
      session.apply(intent({ sequence: 3, playing: phase === 'playing' }));
      await tick();
      expect(
        session.observe(
          observation({
            revision: 3,
            sequence: 3,
            phase,
            rate: phase === 'playing' ? 1 : 0,
            time: 3.99,
          }),
        ),
      ).toBe(false);
      await tick();
      expect(session.snapshot()).toMatchObject({
        error: 'protocol',
        lastConfirmedTime: 4,
      });
      expect(backend.close).toHaveBeenCalledTimes(1);
    },
  );
  it('permits an explicitly acknowledged reverse seek after forward playback', async () => {
    const { session } = make();
    session.apply(intent());
    await tick();
    session.observe(observation());
    session.apply(intent({ sequence: 2, playing: true }));
    await tick();
    session.observe(
      observation({
        revision: 2,
        sequence: 2,
        phase: 'playing',
        rate: 1,
        time: 4,
      }),
    );
    session.apply(intent({ sequence: 3, seekId: 3, targetTime: 2 }));
    await tick();
    expect(
      session.observe(
        observation({ revision: 3, sequence: 3, seekId: 3, time: 2 }),
      ),
    ).toBe(true);
    expect(session.snapshot()).toMatchObject({
      error: null,
      lastConfirmedTime: 2,
    });
    await session.close();
  });
  it('does not accept an ACK for a command still queued behind a blocked writer', async () => {
    const { session, backend } = make();
    const write = deferred<void>();
    backend.write.mockReturnValueOnce(write.promise);
    session.apply(intent());
    await tick();
    session.apply(intent({ sequence: 2 }));
    expect(session.observe(observation({ sequence: 2 }))).toBe(false);
    expect(session.snapshot().error).toBe('protocol');
    write.resolve();
    await tick();
  });
  it('retains close ownership until the writer and all native resources settle', async () => {
    const { session, backend } = make();
    const write = deferred<void>();
    backend.write.mockReturnValueOnce(write.promise);
    session.apply(intent());
    await tick();
    const close = session.close();
    let complete = false;
    void close.then(() => {
      complete = true;
    });
    await tick();
    expect(backend.close).toHaveBeenCalledTimes(1);
    expect(complete).toBe(false);
    expect(() => session.apply(intent({ sequence: 2 }))).toThrow();
    write.resolve();
    await close;
    expect(session.snapshot().closed).toBe(true);
  });
  it('keeps failed close, rejects unknown owner and cannot silently retry cleanup', async () => {
    const { session, backend } = make();
    backend.close.mockResolvedValue({ ...drained, pipesClosed: false });
    expect(() => session.apply(intent({ generation: 'other' }))).toThrow();
    await expect(session.close()).rejects.toThrow('NATIVE_CLEANUP_UNCONFIRMED');
    await expect(session.close()).rejects.toThrow();
    expect(backend.close).toHaveBeenCalledTimes(1);
    expect(session.snapshot()).toMatchObject({
      error: 'cleanup',
      closed: false,
    });
  });
  it('rejects unsupported scope/control changes without altering metadata or the retained intent', async () => {
    const { session } = make();
    session.apply(intent());
    await tick();
    for (const value of [
      { rate: 2 },
      { audioTrack: 3 },
      { targetTime: 10 },
      { sequence: 2, targetTime: 4 },
      { seekId: 0 },
    ])
      expect(() => session.apply(intent(value))).toThrow();
    expect(session.snapshot().intent).toEqual(intent());
    const snapshot = session.snapshot();
    if (snapshot.intent) snapshot.intent.targetTime = 6;
    expect(session.snapshot().intent?.targetTime).toBe(3);
  });
});

it('preserves the existing six-times speed contract while enforcing qualified rates', async () => {
  const backend = {
    write: vi.fn(async () => {}),
    close: vi.fn(async () => drained),
  };
  const session = new NativePlaybackSession(
    { owner, start: 0, end: 10, audioTracks: 3, rates: [0.25, 1, 6] },
    backend,
  );
  session.apply(intent({ rate: 6 }));
  await tick();
  expect(session.observe(observation())).toBe(true);
  session.apply(intent({ sequence: 2, rate: 6, playing: true }));
  await tick();
  expect(
    session.observe(
      observation({
        revision: 2,
        sequence: 2,
        phase: 'playing',
        rate: 6,
        time: 3.5,
      }),
    ),
  ).toBe(true);
  for (const rate of [0, 6.01, Infinity, NaN])
    expect(() => session.apply(intent({ sequence: 3, rate }))).toThrow();
  expect(() => session.apply(intent({ sequence: 3, rate: 2 }))).toThrow(
    'NATIVE_UNQUALIFIED_INTENT',
  );
  await session.close();
});

it.each(['source', 'sequence', 'seek', 'regressed', 'outside', 'running'])(
  'rejects an invalid final stopped clock: %s',
  async (fault) => {
    const { session, backend } = make();
    session.apply(intent());
    await tick();
    session.observe(observation());
    const stopped = {
      ...owner,
      sequence: 1,
      seekId: 1,
      time: 3.01,
      rate: 0 as const,
    };
    if (fault === 'source') stopped.sourceKey = 'b'.repeat(64);
    if (fault === 'sequence') stopped.sequence = 2;
    if (fault === 'seek') {
      stopped.sequence = 2;
      stopped.seekId = 2;
    }
    if (fault === 'regressed') stopped.time = 2.9;
    if (fault === 'outside') stopped.time = 11;
    const result: unknown = {
      ...drained,
      stopped: { ...stopped, rate: fault === 'running' ? 1 : 0 },
    };
    backend.close.mockImplementation(async () => {
      // Simulates an untyped native transport response at the Main boundary.
      return result as NativePlaybackClosed;
    });
    await expect(session.close()).rejects.toThrow();
    expect(session.snapshot().closed).toBe(false);
  },
);

it.each(['volume', 'seek'])(
  'accepts the measured terminal clock of the last processed command while newer %s is delivered but unprocessed',
  async (next) => {
    const { session, backend } = make();
    session.apply(intent());
    await tick();
    session.observe(observation());
    session.apply(intent({ sequence: 2, playing: true }));
    await tick();
    session.observe(
      observation({
        sequence: 2,
        revision: 2,
        phase: 'playing',
        time: 3.2,
        rate: 1,
      }),
    );
    session.apply(
      intent({
        sequence: 3,
        playing: true,
        ...(next === 'volume'
          ? { volume: 0.25 }
          : { seekId: 2, targetTime: 5 }),
      }),
    );
    await tick();
    backend.close.mockResolvedValue({
      ...drained,
      stopped: { ...owner, sequence: 2, seekId: 1, time: 3.266, rate: 0 },
    });
    session.observe(
      observation({
        sequence: 2,
        revision: 3,
        phase: 'starved',
        time: 3.266,
        videoReady: false,
        audioReady: false,
        error: 'media',
      }),
    );
    const closed = await session.close();
    expect(closed.stopped?.time).toBe(3.266);
    expect(session.snapshot()).toMatchObject({
      error: 'media',
      closed: true,
      intent: { sequence: 3 },
    });
  },
);
