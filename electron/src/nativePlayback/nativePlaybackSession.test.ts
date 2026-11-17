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
it('retains the measured CMTime after sub-microsecond conversion rounding', async () => {
  const { session } = make();
  const requested = 1001 / 120000;
  session.apply(intent({ targetTime: requested }));
  await tick();
  const measured = Math.round(requested * 1e9) / 1e9;
  expect(session.observe(observation({ time: measured }))).toBe(true);
  expect(session.snapshot().lastConfirmedTime).toBe(measured);
});
it('rejects a different frame instead of calling it an exact seek', async () => {
  const { session } = make();
  session.apply(intent());
  await tick();
  expect(session.observe(observation({ time: 3.001 }))).toBe(false);
});
it('commits the observed scrub position and resumes there without inventing exactness', async () => {
  const { session } = make();
  session.apply(intent({ targetTime: 7, seekMode: 'scrub' }));
  await tick();
  expect(session.observe(observation({ time: 7.6 }))).toBe(true);
  expect(session.snapshot().lastConfirmedTime).toBe(7.6);
  session.apply(
    intent({ targetTime: 7, seekMode: 'scrub', sequence: 2, playing: true }),
  );
  await tick();
  expect(
    session.observe(
      observation({
        revision: 2,
        sequence: 2,
        time: 7.8,
        phase: 'playing',
        rate: 1,
      }),
    ),
  ).toBe(true);
  expect(session.snapshot().lastConfirmedTime).toBe(7.8);
});
it('uses the displayed preview time for tags, then honors an explicit exact position', async () => {
  const { session } = make();
  session.apply(intent());
  await tick();
  session.observe(observation());
  session.apply(
    intent({ sequence: 2, seekId: 2, targetTime: 7, seekMode: 'preview' }),
  );
  await tick();
  expect(
    session.observe(
      observation({ revision: 2, sequence: 2, seekId: 2, time: 7.6 }),
    ),
  ).toBe(true);
  expect(session.snapshot().observation?.time).toBe(7.6);
  expect(session.snapshot().lastConfirmedTime).toBe(7.6);
  session.apply(intent({ sequence: 3, seekId: 3, targetTime: 7 }));
  await tick();
  expect(
    session.observe(
      observation({ revision: 3, sequence: 3, seekId: 3, time: 7 }),
    ),
  ).toBe(true);
  expect(session.snapshot().lastConfirmedTime).toBe(7);
});
it('retains source confirmation through buffering and resumes in the same seek', async () => {
  const { session, backend } = make();
  session.apply(intent());
  await tick();
  expect(session.observe(observation())).toBe(true);
  session.apply(intent({ sequence: 2, playing: true }));
  await tick();
  expect(
    session.observe(
      observation({
        revision: 2,
        sequence: 2,
        phase: 'playing',
        rate: 1,
        time: 3.2,
      }),
    ),
  ).toBe(true);
  expect(
    session.observe(
      observation({
        revision: 3,
        sequence: 2,
        phase: 'buffering',
        time: 3.205,
        videoReady: false,
        audioReady: false,
      }),
    ),
  ).toBe(true);
  expect(session.snapshot().lastConfirmedTime).toBe(3.2);
  expect(
    session.observe(
      observation({
        revision: 4,
        sequence: 2,
        phase: 'playing',
        rate: 1,
        time: 3.21,
      }),
    ),
  ).toBe(true);
  expect(backend.close).not.toHaveBeenCalled();
  expect(session.snapshot().lastConfirmedTime).toBe(3.21);
  await session.close();
});
it('rejects a resume before the actual buffered stop even when later than the last playing snapshot', async () => {
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
      time: 3.2,
    }),
  );
  session.observe(
    observation({
      revision: 3,
      sequence: 2,
      phase: 'buffering',
      time: 3.205,
      videoReady: false,
      audioReady: false,
    }),
  );
  expect(
    session.observe(
      observation({
        revision: 4,
        sequence: 2,
        phase: 'playing',
        rate: 1,
        time: 3.203,
      }),
    ),
  ).toBe(false);
  expect(session.snapshot().error).toBe('protocol');
  await session.close();
});
it('never treats buffering as a new seek anchor', async () => {
  const { session } = make();
  session.apply(intent());
  await tick();
  expect(
    session.observe(
      observation({ phase: 'buffering', videoReady: false, audioReady: false }),
    ),
  ).toBe(false);
  expect(session.snapshot().error).toBe('protocol');
  await session.close();
});
it('accepts pause after refill in the same seek without automatically playing again', async () => {
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
      phase: 'buffering',
      time: 3.205,
      videoReady: false,
      audioReady: false,
    }),
  );
  session.apply(intent({ sequence: 3, playing: false }));
  await tick();
  expect(
    session.observe(
      observation({
        revision: 3,
        sequence: 2,
        phase: 'playing',
        rate: 1,
        time: 3.21,
      }),
    ),
  ).toBe(false);
  expect(
    session.observe(observation({ revision: 4, sequence: 3, time: 3.205 })),
  ).toBe(true);
  expect(session.snapshot().intent?.playing).toBe(false);
  await session.close();
});
it.each([{ rate: 1 }, { videoReady: true }, { audioReady: true }])(
  'rejects a false buffering clock/readiness ACK: %j',
  async (invalid) => {
    const { session } = make();
    session.apply(intent());
    await tick();
    expect(
      session.observe(
        observation({
          phase: 'buffering',
          videoReady: false,
          audioReady: false,
          ...invalid,
        }),
      ),
    ).toBe(false);
    expect(session.snapshot().error).toBe('protocol');
    await session.close();
  },
);
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

it.each([-0.5, -2, -4, -6])(
  'confirms reverse %s clocks, pause and drainage without extra seeks',
  async (rate) => {
    const backend = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => ({
        ...drained,
        stopped: {
          ...owner,
          sequence: 3,
          seekId: 1,
          time: 20,
          rate: 0 as const,
        },
      })),
    };
    const session = new NativePlaybackSession(
      { owner, start: 0, end: 60, audioTracks: 3, rates: [1, rate] },
      backend,
    );
    session.apply(intent({ targetTime: 30 }));
    await tick();
    expect(session.observe(observation({ time: 30 }))).toBe(true);
    session.apply(intent({ targetTime: 30, playing: true, rate, sequence: 2 }));
    await tick();
    for (let n = 1; n <= 10; n++) {
      expect(
        session.observe(
          observation({
            sequence: 2,
            revision: n + 1,
            phase: 'playing',
            rate,
            time: 30 - n,
          }),
        ),
      ).toBe(true);
    }
    expect(session.snapshot().lastConfirmedTime).toBe(20);
    session.apply(intent({ targetTime: 30, rate, sequence: 3 }));
    await tick();
    expect(
      session.observe(observation({ sequence: 3, revision: 12, time: 20 })),
    ).toBe(true);
    expect(backend.write).toHaveBeenCalledTimes(3);
    expect((await session.close()).stopped?.time).toBe(20);
  },
);
it('rejects forward-moving images in the same reverse command and keeps the confirmed clock', async () => {
  const session = new NativePlaybackSession(
    { owner, start: 0, end: 60, audioTracks: 3, rates: [1, -2] },
    { write: async () => {}, close: async () => drained },
  );
  session.apply(intent());
  await tick();
  session.observe(observation());
  session.apply(intent({ playing: true, rate: -2, sequence: 2 }));
  await tick();
  expect(
    session.observe(
      observation({
        sequence: 2,
        revision: 2,
        phase: 'playing',
        rate: -2,
        time: 2,
      }),
    ),
  ).toBe(true);
  expect(
    session.observe(
      observation({
        sequence: 2,
        revision: 3,
        phase: 'playing',
        rate: -2,
        time: 2.1,
      }),
    ),
  ).toBe(false);
  expect(session.snapshot().lastConfirmedTime).toBe(2);
});

it.each(['playing', 'buffering', 'paused'] as const)(
  'anchors reverse after a seeking notification and a first %s notification',
  async (phase) => {
    const session = new NativePlaybackSession(
      { owner, start: 0, end: 60, audioTracks: 3, rates: [1, -2] },
      { write: async () => {}, close: async () => drained },
    );
    session.apply(intent());
    await tick();
    session.observe(observation());
    session.apply(intent({ playing: true, rate: -2, sequence: 2 }));
    await tick();
    expect(
      session.observe(
        observation({
          sequence: 2,
          revision: 2,
          phase: 'seeking',
          videoReady: false,
          audioReady: false,
        }),
      ),
    ).toBe(true);
    expect(
      session.observe(
        observation({
          sequence: 2,
          revision: 3,
          time: 2.9,
          phase,
          rate: phase === 'playing' ? -2 : 0,
          videoReady: phase !== 'buffering',
          audioReady: phase !== 'buffering',
        }),
      ),
    ).toBe(true);
    expect(
      session.observe(
        observation({
          sequence: 2,
          revision: 4,
          time: 2.8,
          phase: 'playing',
          rate: -2,
        }),
      ),
    ).toBe(true);
    expect(session.snapshot().lastConfirmedTime).toBe(2.8);
    // The timebase moves farther backwards before the forward command arrives.
    session.apply(intent({ playing: true, rate: 1, sequence: 3 }));
    await tick();
    expect(
      session.observe(
        observation({
          sequence: 3,
          revision: 5,
          time: 2.7,
          phase: 'playing',
          rate: 1,
        }),
      ),
    ).toBe(true);
    expect(
      session.observe(
        observation({
          sequence: 3,
          revision: 6,
          time: 2.9,
          phase: 'playing',
          rate: 1,
        }),
      ),
    ).toBe(true);
    expect(
      session.observe(
        observation({
          sequence: 3,
          revision: 7,
          time: 2.8,
          phase: 'playing',
          rate: 1,
        }),
      ),
    ).toBe(false);
  },
);

it('requires a Main-owned presentation verifier for a drawn-pair clock', () => {
  const { backend } = make();
  expect(
    () =>
      new NativePlaybackSession(
        {
          owner,
          start: 0,
          end: 10,
          audioTracks: 1,
          rates: [1],
          clockAuthority: 'drawn-pair',
        },
        backend,
      ),
  ).toThrow('SCOPE');
});
it.each([1, -2])(
  'accepts only ledger-confirmed directional pairs while buffering (%s)',
  async (rate) => {
    const { backend } = make();
    const confirmed = new Set<number>([3]);
    const session = new NativePlaybackSession(
      {
        owner,
        start: 0,
        end: 10,
        audioTracks: 1,
        rates: [rate],
        clockAuthority: 'drawn-pair',
      },
      {
        ...backend,
        confirmsPresentation: (value) => confirmed.has(value.time),
        confirmsPresentedStop: (proof) =>
          proof.ids[0] === 1 && proof.ids[1] === 2,
      },
    );
    session.apply(intent({ rate }));
    await tick();
    expect(session.observe(observation())).toBe(true);
    session.apply(intent({ sequence: 2, playing: true, rate }));
    await tick();
    const direction = Math.sign(rate);
    backend.close.mockResolvedValue({
      ...drained,
      presentedStop: {
        document: 'doc',
        generation: owner.generation,
        operation: 2,
        seekId: 1,
        pair: 1,
        globalTicks: Math.round((3 + direction * 0.12) * 120000),
        ids: [1, 2],
      },
    });
    const ready = 3 + direction * 0.1;
    confirmed.add(ready);
    expect(
      session.observe(
        observation({
          revision: 2,
          sequence: 2,
          phase: 'playing',
          time: ready,
          rate,
        }),
      ),
    ).toBe(true);
    for (const [index, delta] of [0.11, 0.12].entries()) {
      const time = 3 + direction * delta;
      confirmed.add(time);
      expect(
        session.observe(
          observation({
            revision: 3 + index,
            sequence: 2,
            phase: 'buffering',
            time,
            videoReady: false,
            audioReady: false,
          }),
        ),
      ).toBe(true);
    }
    expect(session.snapshot().lastConfirmedTime).toBe(ready);
    // Even genuine old Drawn history cannot authorize moving against direction.
    expect(
      session.observe(
        observation({
          revision: 5,
          sequence: 2,
          phase: 'buffering',
          time: ready,
          videoReady: false,
          audioReady: false,
        }),
      ),
    ).toBe(false);
    expect(session.snapshot().error).toBe('protocol');
    await session.close();
    expect(backend.close).toHaveBeenCalledTimes(1);
  },
);
it.each(['false', 'throw'] as const)(
  'rejects unconfirmed drawn-pair observations: %s',
  async (mode) => {
    const { backend } = make();
    const session = new NativePlaybackSession(
      {
        owner,
        start: 0,
        end: 10,
        audioTracks: 1,
        rates: [1],
        clockAuthority: 'drawn-pair',
      },
      {
        ...backend,
        confirmsPresentedStop: () => false,
        confirmsPresentation: () => {
          if (mode === 'throw') throw Error('ledger');
          return false;
        },
      },
    );
    session.apply(intent());
    await tick();
    expect(session.observe(observation())).toBe(false);
    expect(session.snapshot().lastConfirmedTime).toBe(0);
    await session.close();
    expect(backend.close).toHaveBeenCalledTimes(1);
  },
);
it.each([
  'valid',
  'missing',
  'unissued',
  'ledger-reject',
  'not-started',
] as const)(
  'validates the Main-owned presentation receipt after actual drain: %s',
  async (kind) => {
    const { backend } = make();
    const receipt: NativePlaybackClosed = {
      ...drained,
      presentedStop: {
        document: 'doc',
        generation: owner.generation,
        operation: kind === 'unissued' ? 2 : 1,
        seekId: 1,
        pair: 1,
        globalTicks: 360000,
        ids: [1, 2],
      },
    };
    if (kind === 'missing') delete receipt.presentedStop;
    if (kind === 'not-started') receipt.processStarted = false;
    backend.close.mockResolvedValue(receipt);
    let closing = false;
    const session = new NativePlaybackSession(
      {
        owner,
        start: 0,
        end: 10,
        audioTracks: 1,
        rates: [1],
        clockAuthority: 'drawn-pair',
      },
      {
        ...backend,
        confirmsPresentedStop: () => !(closing && kind === 'ledger-reject'),
        confirmsPresentation: () => true,
      },
    );
    session.apply(intent());
    await tick();
    expect(session.observe(observation())).toBe(true);
    closing = true;
    if (kind === 'valid') expect(await session.close()).toEqual(receipt);
    else
      await expect(session.close()).rejects.toThrow('PRESENTATION_UNCONFIRMED');
    expect(backend.close).toHaveBeenCalledOnce();
  },
);
it('requires a preload release fence only for the same-seek group stop, without relaxing source-clock authority', async () => {
  const backend = {
    write: vi.fn(async (_value: NativePlaybackIntent) => {}),
    close: vi.fn(async () => drained),
    confirmsPresentation: () => true,
    confirmsPresentedStop: () => false,
  };
  const group = new NativePlaybackSession(
    {
      owner,
      start: 0,
      end: 10,
      rates: [-2],
      audioTracks: 1,
      clockAuthority: 'drawn-pair',
    },
    backend,
  );
  group.apply(intent({ rate: -2 }));
  await tick();
  group.apply(intent({ rate: -2, sequence: 2, playing: true }));
  await tick();
  expect(() => group.apply(intent({ rate: -2, sequence: 3 }))).toThrow(
    'FENCE_MISSING',
  );
  const stopped = intent({
    rate: -2,
    sequence: 3,
    presentationFence: {
      document: 'doc',
      generation: owner.generation,
      operation: 1,
      seekId: 1,
      pair: 1,
      globalTicks: 360000,
      ids: [1, 2],
    },
  });
  group.apply(stopped);
  await tick();
  expect(backend.write).toHaveBeenLastCalledWith(stopped);
  await group.close();
  const legacy = make();
  expect(() => legacy.session.apply({ ...stopped, rate: 1 })).toThrow(
    'STOP_AUTHORITY',
  );
  expect(legacy.backend.write).not.toHaveBeenCalled();
  await legacy.session.close();
});

it('delivers a fenced group stop before a re-press while an earlier write is pending', async () => {
  const held = deferred<void>(), delivered = deferred<void>();
  const write = vi.fn(async (value: NativePlaybackIntent) => { if (value.sequence === 2) await held.promise; if (value.sequence === 4) delivered.resolve(); });
  const session = new NativePlaybackSession({ owner, start: 0, end: 10, rates: [-2],
    audioTracks: 1, clockAuthority: 'drawn-pair' }, { write, close: async () => drained,
    confirmsPresentation: () => true, confirmsPresentedStop: () => true });
  session.apply(intent({ rate: -2 })); await tick();
  session.apply(intent({ sequence: 2, playing: true, rate: -2 })); await tick();
  session.apply(intent({ sequence: 3, rate: -2, presentationFence: { document: 'doc',
    generation: owner.generation, operation: 1, seekId: 1, pair: 1, globalTicks: 360000, ids: [1, 2] } }));
  session.apply(intent({ sequence: 4, playing: true, rate: -2 }));
  expect(write.mock.calls.map(([value]) => value.sequence)).toEqual([1, 2]);
  held.resolve(); await delivered.promise;
  expect(write.mock.calls.map(([value]) => value.sequence)).toEqual([1, 2, 3, 4]);
  await session.close();
});

it.each(['latest-stop', 'new-seek'] as const)('bounds unsent group stop barriers: %s', async (kind) => {
  const held = deferred<void>(), delivered = deferred<void>();
  const write = vi.fn(async (value: NativePlaybackIntent) => {
    if (value.sequence === 2) await held.promise;
    if (value.sequence === (kind === 'new-seek' ? 5 : 6)) delivered.resolve();
  });
  const session = new NativePlaybackSession({ owner, start: 0, end: 10, rates: [-2],
    audioTracks: 1, clockAuthority: 'drawn-pair' }, { write, close: async () => drained,
    confirmsPresentation: () => true, confirmsPresentedStop: () => true });
  const fence = { document: 'doc', generation: owner.generation, operation: 1,
    seekId: 1, pair: 1, globalTicks: 360000, ids: [1, 2] };
  session.apply(intent({ rate: -2 })); await tick();
  session.apply(intent({ sequence: 2, playing: true, rate: -2 })); await tick();
  session.apply(intent({ sequence: 3, rate: -2, presentationFence: fence }));
  if (kind === 'new-seek') session.apply(intent({ sequence: 5, seekId: 2, targetTime: 4, rate: -2 }));
  else {
    session.apply(intent({ sequence: 4, playing: true, rate: -2 }));
    session.apply(intent({ sequence: 5, rate: -2, presentationFence: fence }));
    session.apply(intent({ sequence: 6, playing: true, rate: -2 }));
  }
  held.resolve(); await delivered.promise;
  expect(write.mock.calls.map(([value]) => value.sequence)).toEqual(kind === 'new-seek' ? [1, 2, 5] : [1, 2, 5, 6]);
  await session.close();
});
