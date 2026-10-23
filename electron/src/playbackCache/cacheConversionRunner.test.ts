import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runCacheConversion } from './cacheConversionRunner';
import type {
  CacheConversionOptions,
  CacheWorkerEvents,
} from './cacheConversionRunner';
import { PlaybackCacheJob } from './cacheJob';
import type { CacheExpectation } from './cachePolicy';

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};
const harness = (changes: Partial<CacheConversionOptions> = {}) => {
  const abort = new AbortController();
  let events: CacheWorkerEvents | undefined;
  const worker = { terminate: vi.fn(() => true), dispose: vi.fn() };
  const start = vi.fn((next: CacheWorkerEvents) => {
    events = next;
    return worker;
  });
  const options: CacheConversionOptions = {
    signal: abort.signal,
    durationSeconds: 10,
    timeoutMs: 10000,
    budgetPollMs: 100,
    budgetDeadlineMs: 50,
    stopWarningMs: 500,
    maximumDiagnosticBytes: 1000,
    checkBudget: vi.fn(async () => undefined),
    progress: vi.fn(),
    stopWaiting: vi.fn(),
    ...changes,
  };
  const current = (): CacheWorkerEvents => {
    if (!events) throw Error('worker not started');
    return events;
  };
  return {
    abort,
    worker,
    start,
    options,
    events: current,
    run: () => runCacheConversion(start, options),
  };
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
const tick = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

it('does not spawn on prior cancellation or unavailable preflight capacity', async () => {
  const cancelled = harness();
  cancelled.abort.abort();
  await expect(cancelled.run()).rejects.toThrow();
  expect(cancelled.start).not.toHaveBeenCalled();
  const unavailable = harness({
    checkBudget: async () => {
      throw Error('CACHE_CAPACITY');
    },
  });
  await expect(unavailable.run()).rejects.toThrow('CACHE_CAPACITY');
  expect(unavailable.start).not.toHaveBeenCalled();
});

it('bounds a stuck budget preflight without spawning on its late completion', async () => {
  const guard = deferred();
  const h = harness({ checkBudget: () => guard.promise });
  const pending = h.run();
  const rejected = expect(pending).rejects.toThrow('CACHE_BUDGET_UNAVAILABLE');
  await tick(50);
  await rejected;
  guard.resolve();
  await tick();
  expect(h.start).not.toHaveBeenCalled();
});

it('reports monotonic split-line progress and never treats progress=end as completion', async () => {
  const h = harness();
  let settled = false;
  const pending = h.run().then(() => {
    settled = true;
  });
  await tick();
  h.events().output('progress', Buffer.from('out_time_'));
  h.events().output(
    'progress',
    Buffer.from('us=5000000\nout_time_us=1000000\nprogress=end\n'),
  );
  expect(h.options.progress).toHaveBeenLastCalledWith(0.5);
  expect(settled).toBe(false);
  h.events().closed(0, null);
  await pending;
  expect(h.options.progress).toHaveBeenLastCalledWith(1);
  expect(h.worker.terminate).not.toHaveBeenCalled();
  expect(h.worker.dispose).toHaveBeenCalledOnce();
  h.events().output('progress', Buffer.from('out_time_us=2\n'));
  expect(h.options.progress).toHaveBeenLastCalledWith(1);
});

it('cancellation waits for close even if stop request is accepted or close exits zero', async () => {
  const h = harness();
  let settled = false;
  const pending = h.run();
  void pending.catch(() => {
    settled = true;
  });
  await tick();
  h.abort.abort();
  await tick(500);
  expect(h.worker.terminate).toHaveBeenCalledOnce();
  expect(h.options.stopWaiting).toHaveBeenLastCalledWith(true);
  expect(settled).toBe(false);
  h.events().output('progress', Buffer.from('out_time_us=10000000\n'));
  expect(h.options.progress).not.toHaveBeenCalled();
  h.events().closed(0, null);
  await expect(pending).rejects.toThrow('CACHE_CANCELLED');
});

it('does not deliver more progress from the same chunk after the observer cancels', async () => {
  const h = harness();
  const progress = vi.fn(() => h.abort.abort());
  h.options.progress = progress;
  const pending = h.run();
  void pending.catch(() => undefined);
  await tick();
  h.events().output(
    'progress',
    Buffer.from('out_time_us=1000000\nout_time_us=2000000\n'),
  );
  expect(progress).toHaveBeenCalledOnce();
  h.events().closed(null, 'SIGTERM');
  await expect(pending).rejects.toThrow('CACHE_CANCELLED');
});

it.each(['false', 'throw'])(
  'keeps ownership when stop request returns %s',
  async (mode) => {
    const h = harness();
    h.worker.terminate.mockImplementation(() => {
      if (mode === 'throw') throw Error('denied');
      return false;
    });
    const pending = h.run();
    void pending.catch(() => undefined);
    await tick();
    h.abort.abort();
    await tick();
    expect(h.options.stopWaiting).toHaveBeenLastCalledWith(true);
    expect(h.worker.dispose).not.toHaveBeenCalled();
    h.events().closed(null, 'SIGTERM');
    await expect(pending).rejects.toThrow('CACHE_CANCELLED');
  },
);

it('serializes budget reads and stops on a timed-out guard without late restart', async () => {
  const guard = deferred();
  const check = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockImplementation(() => guard.promise);
  const h = harness({ checkBudget: check });
  const pending = h.run();
  void pending.catch(() => undefined);
  await tick(150);
  expect(check).toHaveBeenCalledTimes(2);
  expect(h.worker.terminate).toHaveBeenCalledOnce();
  guard.resolve();
  await tick(1000);
  expect(check).toHaveBeenCalledTimes(2);
  h.events().closed(null, 'SIGTERM');
  await expect(pending).rejects.toThrow('CACHE_BUDGET_UNAVAILABLE');
});

it('ignores a late budget failure after an already-confirmed normal close', async () => {
  const guard = deferred();
  const check = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockImplementation(() => guard.promise);
  const h = harness({ checkBudget: check });
  const pending = h.run();
  await tick(100);
  h.events().closed(0, null);
  await pending;
  await tick(1000);
  expect(h.worker.terminate).not.toHaveBeenCalled();
  expect(h.options.stopWaiting).not.toHaveBeenCalled();
  guard.resolve();
  await tick();
});

it.each(['progress', 'diagnostic', 'timeout', 'error'])(
  'waits for close after %s failure',
  async (failure) => {
    const h = harness();
    let settled = false;
    const pending = h.run();
    void pending.catch(() => {
      settled = true;
    });
    await tick();
    if (failure === 'progress')
      h.events().output('progress', Buffer.alloc(4097, 97));
    if (failure === 'diagnostic')
      h.events().output('diagnostic', Buffer.alloc(1001));
    if (failure === 'error') h.events().error(Error('worker failure'));
    if (failure === 'timeout') await tick(10000);
    expect(h.worker.terminate).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    h.events().closed(1, null);
    await expect(pending).rejects.toThrow();
  },
);

it('handles factory failure and failed exit without losing completion', async () => {
  const h = harness();
  h.start.mockImplementation(() => {
    throw Error('spawn failed');
  });
  await expect(h.run()).rejects.toThrow('spawn failed');
  const next = harness();
  const pending = next.run();
  void pending.catch(() => undefined);
  await tick();
  next.events().closed(2, null);
  await expect(pending).rejects.toThrow('CACHE_WORKER_FAILED');
  expect(next.worker.dispose).toHaveBeenCalledOnce();
});

it('isolates throwing progress and stop observers without releasing ownership', async () => {
  const gone = vi.fn(() => {
    throw Error('UI gone');
  });
  const h = harness({ progress: gone, stopWaiting: gone });
  const pending = h.run();
  void pending.catch(() => undefined);
  await tick();
  expect(() =>
    h.events().output('progress', Buffer.from('out_time_us=1\n')),
  ).not.toThrow();
  expect(gone).toHaveBeenCalledOnce();
  h.abort.abort();
  await tick(500);
  expect(gone).toHaveBeenCalledTimes(3);
  expect(h.worker.dispose).not.toHaveBeenCalled();
  h.events().closed(null, 'SIGTERM');
  await expect(pending).rejects.toThrow('CACHE_CANCELLED');
  expect(h.worker.dispose).toHaveBeenCalledOnce();
  const successful = harness({ progress: gone });
  const completed = successful.run();
  await tick();
  successful.events().closed(0, null);
  await expect(completed).resolves.toBeUndefined();
  expect(gone).toHaveBeenLastCalledWith(1);
});

it('keeps job cleanup, validation, cache selection and retry blocked until child close', async () => {
  const h = harness();
  const discard = vi.fn(async () => undefined);
  const validate = vi.fn();
  const expected: CacheExpectation = {
    source: { sha256: 'a'.repeat(64), bytes: 10 },
    recipe: 'synthetic',
    runtime: 'test',
    timing: {
      fpsNumerator: 1,
      fpsDenominator: 1,
      displayFrames: 10,
      endNumerator: 10,
      endDenominator: 1,
      displayIntervalsSha256: 'b'.repeat(64),
      audio: [],
    },
  };
  const job = new PlaybackCacheJob(
    {
      capacity: async () => ({
        freeBytes: 10000,
        maxBytes: 1000,
        reserveBytes: 100,
      }),
      convert: (signal, progress, _budget, stopWaiting) =>
        runCacheConversion(h.start, {
          ...h.options,
          signal,
          progress,
          stopWaiting,
        }),
      validate,
      publish: vi.fn(),
      discard,
    },
    () => undefined,
  );
  const pending = job.start(expected, 100);
  await tick();
  expect(job.cancel()).toBe(true);
  await tick(500);
  expect(job.status).toMatchObject({
    phase: 'cancelling',
    selected: 'original',
    error: 'stop',
  });
  expect(discard).not.toHaveBeenCalled();
  expect(validate).not.toHaveBeenCalled();
  expect(job.selectCache(true)).toBeNull();
  await expect(job.start(expected, 100)).rejects.toThrow('CACHE_BUSY');
  await job.retryCleanup();
  expect(discard).not.toHaveBeenCalled();
  h.events().closed(null, 'SIGTERM');
  await pending;
  expect(discard).toHaveBeenCalledOnce();
  expect(job.status).toMatchObject({ phase: 'original', error: null });
});
