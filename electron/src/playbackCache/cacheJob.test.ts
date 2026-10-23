import { expect, it, vi } from 'vitest';
import { PlaybackCacheJob } from './cacheJob';
import {
  estimatePlaybackCache,
  hasCacheCapacity,
  isCacheValidationMatching,
} from './cachePolicy';
import type { CacheJobPorts } from './cacheJob';
import type { CacheExpectation, CacheValidation } from './cachePolicy';

const hash = 'a'.repeat(64);
const expected: CacheExpectation = {
  source: { sha256: hash, bytes: 1000 },
  recipe: 'field-v1',
  runtime: 'test-runtime',
  timing: {
    fpsNumerator: 120000,
    fpsDenominator: 1001,
    displayFrames: 120,
    endNumerator: 1001,
    endDenominator: 1000,
    displayIntervalsSha256: hash,
    audio: [1, 2, 3].map((streamIndex) => ({
      streamIndex,
      codec: 'aac',
      packets: 100,
      timesSha256: hash,
      payloadSha256: hash,
      configurationSha256: hash,
    })),
  },
};
const proof = (): CacheValidation => ({
  outputBytes: 2000,
  outputSha256: hash,
  sourceAfter: { ...expected.source },
  recipe: expected.recipe,
  timing: structuredClone(expected.timing),
  hardware: {
    runtime: expected.runtime,
    platformDecoder: true,
    softwareFallback: false,
  },
});
const pending = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} => {
  let resolve = (_value: T): void => {
    throw new Error('not initialized');
  };
  let reject = (_error: Error): void => {
    throw new Error('not initialized');
  };
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const fixture = () => {
  const ports = {
    capacity: vi.fn(async () => ({
      freeBytes: 10000,
      reserveBytes: 1000,
      maxBytes: 5000,
    })),
    convert: vi.fn<CacheJobPorts['convert']>(async (_signal, progress) => {
      progress(0.5);
    }),
    validate: vi.fn(async () => proof()),
    publish: vi.fn(async () => 'opaque-cache-id'),
    discard: vi.fn(async () => undefined),
  };
  const notify = vi.fn();
  return { ports, notify, job: new PlaybackCacheJob(ports, notify) };
};

it('publishes only qualified output and keeps original selected until an explicit paused switch', async () => {
  const { job, ports } = fixture();
  await job.start(expected, 2000);
  expect(job.status).toMatchObject({
    phase: 'ready',
    selected: 'original',
    error: null,
  });
  expect(ports.publish).toHaveBeenCalledOnce();
  expect(job.selectCache(false)).toBeNull();
  expect(job.selectCache(true)).toBe('opaque-cache-id');
  await expect(job.start(expected, 2000)).rejects.toThrow('CACHE_BUSY');
  job.useOriginal();
  expect(job.status.selected).toBe('original');
  expect(ports.discard).not.toHaveBeenCalled();
});

it.each([
  'source',
  'fps',
  'frames',
  'videoTimes',
  'videoEnd',
  'missingAudio',
  'audioTimes',
  'audioPayload',
  'audioConfiguration',
  'audioOrder',
  'runtime',
  'fallback',
  'recipe',
])('rejects %s mismatch before publishing', async (mismatch) => {
  const { job, ports } = fixture();
  const validation = proof();
  switch (mismatch) {
    case 'source':
      validation.sourceAfter.sha256 = 'b'.repeat(64);
      break;
    case 'fps':
      validation.timing.fpsNumerator = 60000;
      break;
    case 'frames':
      validation.timing.displayFrames -= 1;
      break;
    case 'videoTimes':
      validation.timing.displayIntervalsSha256 = 'b'.repeat(64);
      break;
    case 'videoEnd':
      validation.timing.endNumerator += 1;
      break;
    case 'missingAudio':
      validation.timing.audio = validation.timing.audio.slice(1);
      break;
    case 'audioTimes':
      validation.timing.audio[1].timesSha256 = 'b'.repeat(64);
      break;
    case 'audioPayload':
      validation.timing.audio[1].payloadSha256 = 'b'.repeat(64);
      break;
    case 'audioConfiguration':
      validation.timing.audio[1].configurationSha256 = 'b'.repeat(64);
      break;
    case 'audioOrder':
      validation.timing.audio = [...validation.timing.audio].reverse();
      break;
    case 'runtime':
      validation.hardware.runtime = 'different-runtime';
      break;
    case 'fallback':
      validation.hardware.softwareFallback = true;
      break;
    case 'recipe':
      validation.recipe = 'field-v2';
      break;
  }
  ports.validate.mockResolvedValue(validation);
  await job.start(expected, 2000);
  expect(job.status).toMatchObject({
    phase: 'failed',
    selected: 'original',
    error: 'validation',
  });
  expect(ports.publish).not.toHaveBeenCalled();
  expect(ports.discard).toHaveBeenCalledOnce();
  expect(job.selectCache(true)).toBeNull();
});

it('waits for cancelled work to settle, ignores late progress/results, and blocks overlap', async () => {
  const { job, ports } = fixture();
  const work = pending<void>();
  let report: (value: number) => void = () => undefined;
  ports.convert.mockImplementation(async (_signal, progress) => {
    report = progress;
    await work.promise;
  });
  const run = job.start(expected, 2000);
  await vi.waitFor(() => expect(ports.convert).toHaveBeenCalledOnce());
  expect(job.cancel()).toBe(true);
  report(1);
  expect(job.status.phase).toBe('cancelling');
  expect(ports.discard).not.toHaveBeenCalled();
  await expect(job.start(expected, 2000)).rejects.toThrow('CACHE_BUSY');
  work.resolve();
  await run;
  expect(job.status).toMatchObject({ phase: 'original', error: null });
  expect(ports.validate).not.toHaveBeenCalled();
  expect(ports.publish).not.toHaveBeenCalled();
  ports.convert.mockResolvedValue();
  await job.start(expected, 2000);
  report(0.9);
  expect(job.status.progress).toBeNull();
});

it('cancels validation but cannot interrupt atomic publication', async () => {
  const a = fixture();
  const validation = pending<CacheValidation>();
  a.ports.validate.mockReturnValue(validation.promise);
  const run = a.job.start(expected, 2000);
  await vi.waitFor(() => expect(a.ports.validate).toHaveBeenCalledOnce());
  a.job.cancel();
  validation.resolve(proof());
  await run;
  expect(a.ports.publish).not.toHaveBeenCalled();
  const b = fixture();
  const publish = pending<string>();
  b.ports.publish.mockReturnValue(publish.promise);
  const commit = b.job.start(expected, 2000);
  await vi.waitFor(() => expect(b.ports.publish).toHaveBeenCalledOnce());
  expect(b.job.cancel()).toBe(false);
  expect(b.job.selectCache(true)).toBeNull();
  publish.resolve('complete');
  await commit;
  expect(b.job.status.selected).toBe('original');
});

it('does not retry work after failed cleanup until an explicit cleanup succeeds', async () => {
  const { job, ports } = fixture();
  ports.convert.mockRejectedValue(Error('ENOSPC'));
  ports.discard.mockRejectedValueOnce(Error('EACCES'));
  await job.start(expected, 2000);
  expect(job.status.error).toBe('cleanup');
  await expect(job.start(expected, 2000)).rejects.toThrow('CACHE_BUSY');
  await job.retryCleanup();
  ports.convert.mockResolvedValue();
  await job.start(expected, 2000);
  expect(job.status.phase).toBe('ready');
});

it('keeps failed publication unselectable and snapshots the expected source before awaiting', async () => {
  const { job, ports } = fixture();
  const capacity = pending<{
    freeBytes: number;
    reserveBytes: number;
    maxBytes: number;
  }>();
  ports.capacity.mockReturnValue(capacity.promise);
  ports.publish.mockRejectedValue(Error('EIO'));
  const input = structuredClone(expected);
  const run = job.start(input, 2000);
  input.source.sha256 = 'b'.repeat(64);
  capacity.resolve({ freeBytes: 10000, reserveBytes: 1000, maxBytes: 5000 });
  await run;
  expect(ports.publish).toHaveBeenCalledOnce();
  expect(job.selectCache(true)).toBeNull();
  expect(job.status).toMatchObject({ phase: 'failed', error: 'operation' });
});

it('refuses insufficient or invalid capacity before conversion and estimates proportionally', async () => {
  const { job, ports } = fixture();
  await job.start(expected, 9500);
  expect(job.status.error).toBe('capacity');
  expect(ports.convert).not.toHaveBeenCalled();
  expect(
    estimatePlaybackCache(900, {
      duration: 90,
      seconds: 450,
      bytes: 200000000,
    }),
  ).toEqual({ seconds: 4500, bytes: 2000000000 });
  expect(() =>
    estimatePlaybackCache(900, { duration: 0, seconds: 450, bytes: 20 }),
  ).toThrow();
  expect(
    hasCacheCapacity(10, {
      freeBytes: Infinity,
      reserveBytes: 1,
      maxBytes: 10,
    }),
  ).toBe(false);
  const malformed = proof();
  malformed.timing.displayIntervalsSha256 = '';
  expect(isCacheValidationMatching(expected, malformed)).toBe(false);
});

it('does not let initial, progress or ready notification failures strand or reverse a job', async () => {
  const f = fixture();
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const job = new PlaybackCacheJob(f.ports, () => {
    throw new Error('renderer gone');
  });
  try {
    await job.start(expected, 2000);
    expect(job.status).toMatchObject({ phase: 'ready', error: null });
    expect(f.ports.publish).toHaveBeenCalledOnce();
    expect(f.ports.discard).not.toHaveBeenCalled();
    await job.start(expected, 2000);
    expect(job.status.phase).toBe('ready');
    expect(f.ports.publish).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});

it('passes the actual write budget to the runner and refuses an oversized result', async () => {
  const { job, ports } = fixture();
  const validation = proof();
  validation.outputBytes = 5001;
  ports.validate.mockResolvedValue(validation);
  await job.start(expected, 2000);
  expect(ports.convert).toHaveBeenCalledWith(
    expect.any(AbortSignal),
    expect.any(Function),
    { maxBytes: 5000, reserveBytes: 1000 },
  );
  expect(ports.publish).not.toHaveBeenCalled();
  expect(job.status.error).toBe('capacity');
});
