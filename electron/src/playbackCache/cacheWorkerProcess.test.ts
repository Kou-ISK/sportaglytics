import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { spawnCacheWorker } from './cacheWorkerProcess';
import { runCacheConversion } from './cacheConversionRunner';
import { PlaybackCacheJob } from './cacheJob';
import type { CacheExpectation } from './cachePolicy';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
const fakeChild = () =>
  Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true),
  });
beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('uses a direct owned child, requests TERM only, and reports close separately', () => {
  const child = fakeChild();
  // The deliberately narrow fake implements only the child events used here;
  // no real process is launched or signalled by this adapter test.
  vi.mocked(spawn).mockReturnValue(
    child as unknown as ReturnType<typeof spawn>,
  );
  const events = { output: vi.fn(), error: vi.fn(), closed: vi.fn() };
  const args = ['-progress', 'pipe:1', 'synthetic.mp4'];
  const worker = spawnCacheWorker('/bundled/ffmpeg', args, events);
  expect(spawn).toHaveBeenCalledWith('/bundled/ffmpeg', args, {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.write('out_time_us=1\n');
  child.stderr.write('diagnostic');
  expect(events.output).toHaveBeenCalledTimes(2);
  expect(worker.terminate()).toBe(true);
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
  expect(events.closed).not.toHaveBeenCalled();
  child.emit('error', Error('stop error'));
  expect(events.error).toHaveBeenCalledOnce();
  child.emit('close', null, 'SIGTERM');
  expect(events.closed).toHaveBeenCalledExactlyOnceWith(null, 'SIGTERM');
  worker.dispose();
  expect(child.listenerCount('error')).toBe(0);
  expect(child.stdout.listenerCount('data')).toBe(0);
  expect(child.stderr.listenerCount('data')).toBe(0);
  expect(child.stdout.listenerCount('error')).toBe(0);
  expect(child.stderr.listenerCount('error')).toBe(0);
});

it.each(['missing-stdout', 'missing-stderr', 'stdout-error', 'stderr-error'])(
  'keeps cleanup and retry blocked until close after %s',
  async (failure) => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), {
      stdout: failure === 'missing-stdout' ? null : new PassThrough(),
      stderr: failure === 'missing-stderr' ? undefined : new PassThrough(),
      kill: vi.fn(() => true),
    });
    // Failed spawn may omit pipes despite the spawn overload's non-null type.
    // This narrow fake only emits events; no real process is launched.
    vi.mocked(spawn).mockReturnValue(
      child as unknown as ReturnType<typeof spawn>,
    );
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
    const discard = vi.fn(async () => undefined);
    const validate = vi.fn();
    const job = new PlaybackCacheJob(
      {
        capacity: async () => ({
          freeBytes: 10000,
          maxBytes: 1000,
          reserveBytes: 100,
        }),
        convert: (signal, progress, _budget, stopWaiting) =>
          runCacheConversion(
            (events) => spawnCacheWorker('/bundled/ffmpeg', [], events),
            {
              signal,
              progress,
              stopWaiting,
              durationSeconds: 10,
              timeoutMs: 10000,
              budgetPollMs: 100,
              budgetDeadlineMs: 50,
              stopWarningMs: 500,
              maximumDiagnosticBytes: 1000,
              checkBudget: async () => undefined,
            },
          ),
        validate,
        publish: vi.fn(),
        discard,
      },
      () => undefined,
    );
    let settled = false;
    const pending = job.start(expected, 100).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(() => {
      if (failure === 'stdout-error')
        child.stdout?.emit('error', Error('pipe failed'));
      else if (failure === 'stderr-error')
        child.stderr?.emit('error', Error('pipe failed'));
      else child.emit('error', Error('spawn failed'));
    }).not.toThrow();
    await vi.advanceTimersByTimeAsync(500);
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    expect(settled).toBe(false);
    expect(discard).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(job.status).toMatchObject({
      phase: 'cancelling',
      selected: 'original',
      error: 'stop',
    });
    await expect(job.start(expected, 100)).rejects.toThrow('CACHE_BUSY');
    await job.retryCleanup();
    expect(discard).not.toHaveBeenCalled();
    child.emit('close', 1, null);
    await pending;
    expect(discard).toHaveBeenCalledOnce();
    expect(child.listenerCount('error')).toBe(0);
    expect(child.stdout?.listenerCount('error') ?? 0).toBe(0);
    expect(child.stderr?.listenerCount('error') ?? 0).toBe(0);
  },
);

it('rejects a relative executable before spawning', () => {
  expect(() =>
    spawnCacheWorker('ffmpeg', [], {
      output: vi.fn(),
      error: vi.fn(),
      closed: vi.fn(),
    }),
  ).toThrow('CACHE_INVALID_EXECUTABLE');
  expect(spawn).not.toHaveBeenCalled();
});
