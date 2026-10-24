import { describe, expect, it, vi } from 'vitest';
import { CacheRangePipeline } from './cacheRangePipeline';
const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const requests = [0, 1, 2].map((id) => ({ id, maximumBytes: 10 }));
describe('CacheRangePipeline', () => {
  it('overlaps producer and consumer, bounds to two batches, orders delivery', async () => {
    const p = [0, 1, 2].map(() => deferred<{ id: number }>()),
      c = [0, 1, 2].map(() => deferred<void>()),
      delivered: number[] = [];
    const produce = vi.fn((r: { id: number }) => p[r.id].promise),
      consume = vi.fn(async (v: { id: number }) => {
        delivered.push(v.id);
        await c[v.id].promise;
      }),
      release = vi.fn(async () => undefined);
    const pipeline = new CacheRangePipeline(
      new AbortController().signal,
      { produce, consume, release, failed: vi.fn() },
      20,
    );
    const done = pipeline.run(requests);
    await tick();
    expect(produce).toHaveBeenCalledTimes(1);
    p[0].resolve({ id: 0 });
    await tick();
    expect(produce).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(pipeline.retainedBytes).toBe(20);
    p[1].resolve({ id: 1 });
    await tick();
    expect(produce).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledTimes(1);
    c[0].resolve();
    await tick();
    expect(produce).toHaveBeenCalledTimes(3);
    expect(delivered).toEqual([0, 1]);
    p[2].resolve({ id: 2 });
    c[1].resolve();
    await tick();
    c[2].resolve();
    await done;
    expect(delivered).toEqual([0, 1, 2]);
    expect(release).toHaveBeenCalledTimes(3);
    expect(pipeline.retainedBytes).toBe(0);
  });
  it('cancellation retains unknown producer until close; no late result is delivered', async () => {
    const p = deferred<{ id: number }>(),
      failed = vi.fn(),
      release = vi.fn(async () => undefined),
      consume = vi.fn();
    const pipeline = new CacheRangePipeline(
      new AbortController().signal,
      { produce: () => p.promise, consume, release, failed },
      20,
    );
    const done = pipeline.run(requests);
    void done.catch(() => undefined);
    await tick();
    let settled = false;
    void pipeline.cancel().catch(() => {
      settled = true;
    });
    await tick();
    expect(settled).toBe(false);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(pipeline.retainedBytes).toBe(10);
    p.resolve({ id: 0 });
    await expect(done).rejects.toThrow('CANCELLED');
    expect(consume).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it('Session change during delivery waits for ACK settlement and cancels next producer', async () => {
    const session = new AbortController(),
      delivery = deferred<void>(),
      next = deferred<{ id: number }>(),
      failed = vi.fn();
    const consume = vi.fn(() => delivery.promise),
      produce = vi.fn(async (r: { id: number }) =>
        r.id ? next.promise : { id: 0 },
      ),
      release = vi.fn(async () => undefined);
    const pipeline = new CacheRangePipeline(
        session.signal,
        { produce, consume, release, failed },
        20,
      ),
      done = pipeline.run(requests);
    void done.catch(() => undefined);
    await tick();
    session.abort(Error('SESSION_CHANGED'));
    await tick();
    expect(pipeline.retainedBytes).toBe(20);
    expect(release).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
    delivery.resolve();
    await tick();
    next.resolve({ id: 1 });
    await expect(done).rejects.toThrow('SESSION_CHANGED');
    expect(consume).toHaveBeenCalledTimes(1);
    expect(produce).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });
  it('validation failure requests fallback once and never supplies a next batch', async () => {
    const error = Error('BAD_FULL_PROOF'),
      failed = vi.fn(() => {
        throw Error('observer');
      }),
      consume = vi.fn(async () => {
        throw error;
      }),
      release = vi.fn(async () => undefined);
    const pipeline = new CacheRangePipeline(
      new AbortController().signal,
      { produce: async (r) => ({ id: r.id }), consume, release, failed },
      20,
    );
    await expect(pipeline.run(requests)).rejects.toBe(error);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(pipeline.retainedBytes).toBe(0);
  });
  it('cleanup failure stays charged and is not automatically retried', async () => {
    const release = vi.fn(async () => {
      throw Error('CLOSE_FAILED');
    });
    const pipeline = new CacheRangePipeline(
      new AbortController().signal,
      {
        produce: async () => ({}),
        consume: async () => undefined,
        release,
        failed: vi.fn(),
      },
      10,
    );
    await expect(pipeline.run(requests.slice(0, 1))).rejects.toThrow('CLEANUP');
    expect(release).toHaveBeenCalledTimes(1);
    expect(pipeline.retainedBytes).toBe(10);
    await expect(pipeline.cancel()).rejects.toThrow('CLEANUP');
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('insufficient overlap capacity serializes instead of overallocating', async () => {
    let pending = 0;
    const pipeline = new CacheRangePipeline(
      new AbortController().signal,
      {
        produce: async () => {
          expect(pending++).toBe(0);
          return {};
        },
        consume: async () => undefined,
        release: async () => {
          pending--;
        },
        failed: vi.fn(),
      },
      10,
    );
    await pipeline.run(requests);
    expect(pipeline.retainedBytes).toBe(0);
  });
  it('rejects invalid reservations, duplicate IDs and owner reuse before work', async () => {
    const produce = vi.fn(async () => ({})),
      pipeline = new CacheRangePipeline(
        new AbortController().signal,
        {
          produce,
          consume: async () => undefined,
          release: async () => undefined,
          failed: vi.fn(),
        },
        10,
      );
    await expect(
      pipeline.run([
        { id: 0, maximumBytes: 10 },
        { id: 0, maximumBytes: 10 },
      ]),
    ).rejects.toThrow('REQUEST');
    expect(produce).not.toHaveBeenCalled();
    await expect(pipeline.run([])).rejects.toThrow('USED');
  });
});
