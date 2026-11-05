import { describe, expect, it, vi } from 'vitest';
import { createNativeGestureQueue } from './nativeGestureQueue';
import type { NativeCommandLeftEvent } from '../types/ipc/nativeCommandLeft';
const ev = (
  phase: 'down' | 'up',
  gesture: number,
  serial: number,
): NativeCommandLeftEvent => ({
  phase,
  gesture,
  serial,
  epoch: 1,
  meta: true,
  shift: false,
  alt: false,
  control: false,
});
const tick = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const opts = (
  changes: Partial<Parameters<typeof createNativeGestureQueue>[0]> = {},
) => ({
  claimStart: async () => 'active' as const,
  abandonClaim: async () => {},
  start: async (e: NativeCommandLeftEvent) => String(e.gesture),
  finish: async () => {},
  onOverflow: () => {},
  limit: 8,
  initialEpoch: 1,
  ...changes,
});
describe('ordered native gesture queue', () => {
  it('accepts one delayed release after an ended claim has already settled', async () => {
    const finish = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ claimStart: async () => 'ended', finish }));
    expect(q.receive(ev('down', 1, 1))).toBe(true); await tick();
    expect(finish).toHaveBeenCalledOnce();
    expect(q.receive(ev('up', 1, 2))).toBe(true);
    expect(q.receive(ev('up', 1, 3))).toBe(false);
    expect(finish).toHaveBeenCalledOnce();
  });
  it('accepts the delayed release once while an ended claim is starting', async () => {
    const start = Promise.withResolvers<string>(); const finish = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ claimStart: async () => 'ended', start: () => start.promise, finish }));
    q.receive(ev('down', 1, 1)); await tick();
    expect(q.receive(ev('up', 1, 2))).toBe(true);
    expect(q.receive(ev('up', 1, 3))).toBe(false);
    start.resolve('one'); await tick(); expect(finish).toHaveBeenCalledOnce();
  });
  it.each(['null', 'throw'])('drains the captured claim when start returns %s', async (mode) => {
    const abandonClaim = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ abandonClaim, start: async () => {
      if (mode === 'throw') throw Error('start failed');
      return null;
    } }));
    q.receive(ev('down', 1, 1)); await tick();
    expect(abandonClaim).toHaveBeenCalledWith(ev('down', 1, 1));
  });
  it('still drains a claim when the failure notification itself throws', async () => {
    const abandonClaim = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ abandonClaim,
      start: async () => { throw Error('start failed'); },
      onFailure: () => { throw Error('listener failed'); } }));
    q.receive(ev('down', 1, 1)); await tick();
    expect(abandonClaim).toHaveBeenCalledOnce();
  });
  it('revokes a claim that succeeds after cancellation before resolving cleanup', async () => {
    const pending = Promise.withResolvers<'active' | 'ended' | 'invalid'>();
    const revoked = Promise.withResolvers<void>();
    const abandonClaim = vi.fn(() => revoked.promise);
    const start = vi.fn(async () => 'must-not-start');
    const q = createNativeGestureQueue(opts({ claimStart: () => pending.promise, abandonClaim, start }));
    q.receive(ev('down', 1, 1)); await tick();
    const done = q.cancelAndWait();
    pending.resolve('ended'); await tick();
    expect(abandonClaim).toHaveBeenCalledWith(ev('down', 1, 1));
    expect(start).not.toHaveBeenCalled();
    let completed = false; void done.then(() => { completed = true; });
    await tick(); expect(completed).toBe(false);
    revoked.resolve(); await done; expect(completed).toBe(true);
  });
  it('preserves two completed taps in order', async () => {
    let resolve!: (value: 'active' | 'ended' | 'invalid') => void;
    const first = new Promise<'active' | 'ended' | 'invalid'>((r) => {
      resolve = r;
    });
    const events: string[] = [];
    const claimStart = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValue('active');
    const queue = createNativeGestureQueue(
      opts({
        claimStart,
        start: async (e) => {
          events.push(`start${e.gesture}`);
          return String(e.gesture);
        },
        finish: async (e) => {
          events.push(`finish${e.gesture}`);
        },
      }),
    );
    queue.receive(ev('down', 1, 1));
    queue.receive(ev('up', 1, 2));
    queue.receive(ev('down', 2, 3));
    queue.receive(ev('up', 2, 4));
    await tick();
    resolve('active');
    await tick();
    expect(events).toEqual(['start1', 'finish1', 'start2', 'finish2']);
  });
  it('waits for old token settlement before starting another', async () => {
    let release!: () => void;
    const done = new Promise<void>((r) => {
      release = r;
    });
    const start = vi.fn(async (e: NativeCommandLeftEvent) => String(e.gesture));
    const q = createNativeGestureQueue(
      opts({ start, finish: async () => done }),
    );
    q.receive(ev('down', 1, 1));
    await tick();
    q.receive(ev('up', 1, 2));
    q.receive(ev('down', 2, 3));
    await tick();
    expect(start).toHaveBeenCalledTimes(1);
    release();
    await tick();
    expect(start).toHaveBeenCalledTimes(2);
  });
  it('finishes the specific token if cancelled while start is pending', async () => {
    let resolve!: (v: string) => void;
    const start = new Promise<string>((r) => {
      resolve = r;
    });
    const finish = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ start: () => start, finish }));
    q.receive(ev('down', 1, 1));
    await tick();
    q.cancel();
    resolve('session-1');
    await tick();
    expect(finish).toHaveBeenCalledWith(ev('down', 1, 1), 'session-1');
  });
  it('invalidates pending without discarding a started hold', async () => {
    const finish = vi.fn(async () => {});
    const q = createNativeGestureQueue(opts({ finish }));
    q.receive(ev('down', 1, 1));
    await tick();
    q.invalidatePending();
    q.receive(ev('up', 1, 2));
    await tick();
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it('reports overflow and cancels pending work', async () => {
    let resolve!: (value: 'active' | 'ended' | 'invalid') => void;
    const waiting = new Promise<'active' | 'ended' | 'invalid'>((r) => {
      resolve = r;
    });
    const start = vi.fn(async () => 'x'),
      onOverflow = vi.fn();
    const q = createNativeGestureQueue(
      opts({ claimStart: () => waiting, start, onOverflow, limit: 1 }),
    );
    q.receive(ev('down', 1, 1));
    q.receive(ev('down', 2, 2));
    resolve('active');
    await tick();
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });
});

it('fails closed even when finishing rejects without an error value', async () => {
  const start = vi.fn(async (e: NativeCommandLeftEvent) => String(e.gesture));
  const q = createNativeGestureQueue(
    opts({ start, finish: async () => Promise.reject() }),
  );
  q.receive(ev('down', 1, 1));
  await tick();
  q.receive(ev('up', 1, 2));
  await tick();
  q.receive(ev('down', 2, 3));
  await tick();
  expect(start).toHaveBeenCalledTimes(1);
  let rejected = false;
  try {
    await q.cancelAndWait();
  } catch {
    rejected = true;
  }
  expect(rejected).toBe(true);
});

it('cancelAndWait waits for an in-flight start and its token to finish', async () => {
  let startResolve!: (v: string) => void;
  let finishResolve!: () => void;
  const start = new Promise<string>((r) => {
    startResolve = r;
  });
  const finish = new Promise<void>((r) => {
    finishResolve = r;
  });
  let done = false;
  const q = createNativeGestureQueue(
    opts({ start: () => start, finish: () => finish }),
  );
  q.receive(ev('down', 1, 1));
  await tick();
  const stopped = q.cancelAndWait().then(() => {
    done = true;
  });
  startResolve('one');
  await tick();
  expect(done).toBe(false);
  finishResolve();
  await stopped;
  expect(done).toBe(true);
});

it('suspends admission until old token settles and explicit resume', async () => {
  let finishResolve!: () => void;
  const finish = new Promise<void>((r) => {
    finishResolve = r;
  });
  const start = vi.fn(async (e: NativeCommandLeftEvent) => String(e.gesture));
  const q = createNativeGestureQueue(opts({ start, finish: () => finish }));
  q.receive(ev('down', 1, 1));
  await tick();
  const suspended = q.suspendAndWait();
  q.receive(ev('down', 2, 2));
  await tick();
  expect(start).toHaveBeenCalledTimes(1);
  finishResolve();
  await suspended;
  q.receive(ev('down', 3, 3));
  await tick();
  expect(start).toHaveBeenCalledTimes(1);
  expect(q.resume(2)).toBe(true);
  q.receive(ev('down', 4, 4));
  await tick();
  expect(start).toHaveBeenCalledTimes(1);
  q.receive({ ...ev('down', 5, 5), epoch: 2 });
  await tick();
  expect(start).toHaveBeenCalledTimes(2);
});

it('does not resume while a validation from the old epoch is pending', async () => {
  let resolve!: (value: 'active' | 'ended' | 'invalid') => void;
  const waiting = new Promise<'active' | 'ended' | 'invalid'>((r) => {
    resolve = r;
  });
  const start = vi.fn(async () => 'x');
  const q = createNativeGestureQueue(
    opts({ claimStart: () => waiting, start }),
  );
  q.receive(ev('down', 1, 1));
  await tick();
  const suspended = q.suspendAndWait();
  expect(q.resume(2)).toBe(false);
  resolve('active');
  await suspended;
  expect(start).not.toHaveBeenCalled();
  expect(q.resume(2)).toBe(true);
});
it('does not publish a playing mirror for a tap released before its queued start', async () => {
  let release!: () => void;
  const firstStop = new Promise<void>((r) => {
    release = r;
  });
  const started: number[] = [];
  const finish = vi
    .fn()
    .mockReturnValueOnce(firstStop)
    .mockResolvedValue(undefined);
  const q = createNativeGestureQueue(
    opts({
      onStarted: (event) => {
        started.push(event.gesture);
      },
      finish,
    }),
  );
  q.receive(ev('down', 1, 1));
  await tick();
  q.receive(ev('up', 1, 2));
  q.receive(ev('down', 2, 3));
  q.receive(ev('up', 2, 4));
  await tick();
  expect(started).toEqual([1]);
  release();
  await tick();
  expect(started).toEqual([1]);
  expect(finish).toHaveBeenCalledTimes(2);
});

it('starts an already released short tap once and immediately settles its stop', async () => {
  const events: string[] = [];
  const started = vi.fn();
  const q = createNativeGestureQueue(
    opts({
      claimStart: async () => 'ended',
      start: async () => {
        events.push('start');
        return 'token';
      },
      finish: async () => {
        events.push('stop');
      },
      onStarted: started,
    }),
  );
  q.receive(ev('down', 1, 1));
  await tick();
  expect(events).toEqual(['start', 'stop']);
  expect(started).not.toHaveBeenCalled();
});
