import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runCacheConversion } from './cacheConversionRunner';
import type { CacheWorkerEvents } from './cacheConversionRunner';
import { openPlaybackCacheStorage } from './cacheStorage';
import { CACHE_METADATA_BUDGET } from './cacheStorageIo';
import { PlaybackCacheJob } from './cacheJob';
import type { CacheExpectation, CacheValidation } from './cachePolicy';
import type { CacheStaging } from './cacheStorage';

let root: string;
const stages: CacheStaging[] = [];
const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const payload = 'synthetic payload for filesystem tests';
const expectation: CacheExpectation = {
  source: { sha256: hash('original'), bytes: 8 },
  recipe: 'test-field-recipe',
  runtime: 'test-runtime',
  timing: {
    fpsNumerator: 120,
    fpsDenominator: 1,
    displayFrames: 120,
    endNumerator: 1,
    endDenominator: 1,
    displayIntervalsSha256: hash('all-display-intervals'),
    audio: [0, 1, 2].map((streamIndex) => ({
      streamIndex,
      codec: 'aac',
      packets: 10,
      timesSha256: hash('all-packet-times'),
      payloadSha256: hash('all-payloads'),
      configurationSha256: hash('all-track-settings'),
    })),
  },
};
const proof = (): CacheValidation => ({
  outputBytes: Buffer.byteLength(payload),
  outputSha256: hash(payload),
  sourceAfter: expectation.source,
  recipe: expectation.recipe,
  timing: expectation.timing,
  hardware: {
    runtime: expectation.runtime,
    platformDecoder: true,
    softwareFallback: false,
  },
});
const open = (maximumCacheBytes = 1024 * 1024, reserveBytes = 0) =>
  openPlaybackCacheStorage(root, { maximumCacheBytes, reserveBytes });
const stage = async (
  maximumCacheBytes = 1024 * 1024,
  maximumOutputBytes = 1024,
): Promise<CacheStaging> => {
  const result = await (
    await open(maximumCacheBytes)
  ).begin(expectation, maximumOutputBytes);
  stages.push(result);
  return result;
};
beforeEach(async () => {
  root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-')),
  );
});
afterEach(async () => {
  for (const pending of stages.splice(0))
    await pending.discard().catch(() => undefined);
  await fs.rm(root, { recursive: true, force: true });
});

it('connects real storage to the job while keeping the source and explicit selection intact', async () => {
  const source = path.join(root, 'original.bin');
  await fs.writeFile(source, 'original');
  const storage = await open();
  const pending = await storage.begin(expectation, 1024);
  stages.push(pending);
  const job = new PlaybackCacheJob(
    {
      capacity: pending.capacity,
      convert: (signal, progress, _budget, stopWaiting) =>
        runCacheConversion(
          (events) => {
            // Synthetic worker events; filesystem and job/storage ports are real.
            void fs.writeFile(pending.outputPath, payload, { flag: 'wx' }).then(
              () => events.closed(0, null),
              (error: unknown) => {
                events.error(
                  error instanceof Error ? error : Error('write failed'),
                );
                events.closed(1, null);
              },
            );
            return { terminate: () => true, dispose: () => undefined };
          },
          {
            signal,
            progress,
            stopWaiting,
            durationSeconds: 1,
            timeoutMs: 2000,
            budgetPollMs: 20,
            budgetDeadlineMs: 1000,
            stopWarningMs: 100,
            maximumDiagnosticBytes: 1000,
            checkBudget: pending.checkBudget,
          },
        ),
      validate: async (signal) => {
        const validation = proof();
        await pending.seal(validation, signal);
        return validation;
      },
      publish: pending.publish,
      discard: pending.discard,
    },
    () => undefined,
  );
  await job.start(expectation, payload.length);
  expect(job.status).toMatchObject({ phase: 'ready', selected: 'original' });
  expect(job.selectCache(false)).toBeNull();
  const id = job.selectCache(true);
  expect(id).toBeTruthy();
  if (!id) throw Error('Missing ready artifact');
  const reopened = await (await open()).inspectCandidate(id, expectation);
  expect(reopened).toMatchObject({
    sha256: hash(payload),
    bytes: payload.length,
    artifactId: id,
  });
  expect(await fs.readFile(reopened!.mediaPath, 'utf8')).toBe(payload);
  job.useOriginal();
  await pending.discard(); // A later failure/cleanup cannot delete a ready copy.
  expect(await storage.inspectCandidate(id, expectation)).not.toBeNull();
  expect(await fs.readFile(source, 'utf8')).toBe('original');
});

it('connects disk capacity failure to worker stop and preserves staging until close', async () => {
  const pending = await stage(1024 * 1024, 10);
  let workerEvents: CacheWorkerEvents | undefined;
  let started = (): void => undefined;
  const workerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let stopped = (): void => undefined;
  const stopRequested = new Promise<void>((resolve) => {
    stopped = resolve;
  });
  const validate = vi.fn();
  const publish = vi.fn(pending.publish);
  const discard = vi.fn(pending.discard);
  const job = new PlaybackCacheJob(
    {
      capacity: pending.capacity,
      validate,
      publish,
      discard,
      convert: (signal, progress, _budget, stopWaiting) =>
        runCacheConversion(
          (events) => {
            workerEvents = events;
            started();
            return {
              terminate: () => {
                stopped();
                return true;
              },
              dispose: () => undefined,
            };
          },
          {
            signal,
            progress,
            stopWaiting,
            durationSeconds: 1,
            timeoutMs: 2000,
            budgetPollMs: 10,
            budgetDeadlineMs: 1000,
            stopWarningMs: 100,
            maximumDiagnosticBytes: 1000,
            checkBudget: pending.checkBudget,
          },
        ),
    },
    () => undefined,
  );
  const completion = job.start(expectation, 10);
  await workerStarted;
  await fs.writeFile(pending.outputPath, 'elevenbytes');
  await stopRequested;
  expect(job.status.phase).toBe('cancelling');
  expect(discard).not.toHaveBeenCalled();
  expect((await fs.stat(pending.outputPath)).size).toBe(11);
  if (!workerEvents) throw Error('missing synthetic worker');
  workerEvents.closed(null, 'SIGTERM');
  await completion;
  expect(validate).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
  expect(discard).toHaveBeenCalledOnce();
  await expect(fs.stat(pending.outputPath)).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('does not publish unsealed or mismatched media and never adopts a pending directory', async () => {
  const pending = await stage();
  await fs.writeFile(pending.outputPath, 'different bytes');
  await expect(pending.publish()).rejects.toThrow('CACHE_NOT_SEALED');
  const id = path
    .basename(path.dirname(pending.outputPath))
    .slice('.pending-'.length);
  expect(await (await open()).inspectCandidate(id, expectation)).toBeNull();
  await expect(pending.seal(proof())).rejects.toThrow('CACHE_OUTPUT_CHANGED');
  await expect(pending.publish()).rejects.toThrow('CACHE_NOT_SEALED');
  await pending.discard();
  expect(await fs.readdir(path.join(root, 'playback-cache-v1'))).toEqual([]);
});

it.each(['source', 'timing', 'audio', 'runtime', 'fallback'])(
  'rejects %s proof before producing a ready artifact',
  async (mismatch) => {
    const pending = await stage();
    await fs.writeFile(pending.outputPath, payload);
    const validation = structuredClone(proof());
    if (mismatch === 'source') validation.sourceAfter.sha256 = hash('changed');
    if (mismatch === 'timing') validation.timing.endNumerator = 2;
    if (mismatch === 'audio') validation.timing.audio = [];
    if (mismatch === 'runtime') validation.hardware.runtime = 'other';
    if (mismatch === 'fallback') validation.hardware.softwareFallback = true;
    await expect(pending.seal(validation)).rejects.toThrow('CACHE_VALIDATION');
    await expect(pending.publish()).rejects.toThrow('CACHE_NOT_SEALED');
  },
);

it.each(['media', 'manifest'])(
  'detects %s replacement after sealing and preserves earlier ready media',
  async (target) => {
    const original = await stage();
    await fs.writeFile(original.outputPath, payload);
    await original.seal(proof());
    const id = await original.publish();
    const pending = await stage();
    await fs.writeFile(pending.outputPath, payload);
    await pending.seal(proof());
    const file =
      target === 'media'
        ? pending.outputPath
        : path.join(path.dirname(pending.outputPath), 'manifest.json');
    await fs.writeFile(file, 'tampered');
    await expect(pending.publish()).rejects.toThrow('CACHE_OUTPUT_CHANGED');
    await pending.discard();
    expect(
      await (await open()).inspectCandidate(id, expectation),
    ).not.toBeNull();
  },
);

it('bounds total usage including interrupted output and admits one writer across adapters', async () => {
  const storage = await open(CACHE_METADATA_BUDGET + 200);
  const interrupted = path.join(
    root,
    'playback-cache-v1',
    `.pending-${randomUUID()}`,
  );
  await fs.mkdir(interrupted);
  await fs.writeFile(path.join(interrupted, 'media.mp4'), Buffer.alloc(150));
  const pending = await storage.begin(expectation, 1024);
  stages.push(pending);
  expect((await pending.capacity()).maxBytes).toBe(50);
  await expect((await open()).begin(expectation, 10)).rejects.toThrow(
    'CACHE_BUSY',
  );
  await fs.writeFile(pending.outputPath, Buffer.alloc(51));
  await expect(pending.checkBudget()).rejects.toThrow('CACHE_CAPACITY');
  await expect(pending.seal({ ...proof(), outputBytes: 51 })).rejects.toThrow(
    'CACHE_CAPACITY',
  );
  await pending.discard();
  const next = await stage();
  await next.discard();
  expect((await fs.stat(path.join(interrupted, 'media.mp4'))).size).toBe(150);
});

it('refuses impossible free-space reserve without creating a stage', async () => {
  await expect(
    (
      await open(1024 * 1024, Number.MAX_SAFE_INTEGER - CACHE_METADATA_BUDGET)
    ).begin(expectation, 100),
  ).rejects.toThrow('CACHE_CAPACITY');
  expect(await fs.readdir(path.join(root, 'playback-cache-v1'))).toEqual([]);
});

it('cancelled seal remains private, can be discarded repeatedly, and admits a new generation', async () => {
  const pending = await stage();
  await fs.writeFile(pending.outputPath, payload);
  await expect(pending.seal(proof(), AbortSignal.abort())).rejects.toThrow();
  await expect(pending.publish()).rejects.toThrow('CACHE_NOT_SEALED');
  await pending.discard();
  await pending.discard();
  const next = await stage();
  await next.discard();
});

it('keeps ownership after cleanup failure and retries only its fixed staging files', async () => {
  const pending = await stage();
  const unexpected = path.join(
    path.dirname(pending.outputPath),
    'unrelated.txt',
  );
  await fs.writeFile(unexpected, 'keep');
  await expect(pending.discard()).rejects.toThrow('CACHE_UNEXPECTED_ENTRY');
  expect(await fs.readFile(unexpected, 'utf8')).toBe('keep');
  await expect((await open()).begin(expectation, 100)).rejects.toThrow(
    'CACHE_BUSY',
  );
  await fs.unlink(unexpected);
  await pending.discard();
  const next = await stage();
  await next.discard();
});

it('rejects a symlinked root and never traverses symlink/hardlink outputs on failure cleanup', async () => {
  const outside = path.join(root, 'outside');
  await fs.mkdir(outside);
  const cache = path.join(root, 'playback-cache-v1');
  await fs.symlink(outside, cache);
  await expect(open()).rejects.toThrow('CACHE_UNSAFE_DIRECTORY');
  await fs.unlink(cache);
  const source = path.join(outside, 'original.bin');
  await fs.writeFile(source, payload);
  for (const kind of ['symlink', 'hardlink']) {
    const pending = await stage();
    if (kind === 'symlink') await fs.symlink(source, pending.outputPath);
    else await fs.link(source, pending.outputPath);
    await expect(pending.seal(proof())).rejects.toThrow();
    await pending.discard();
    expect(await fs.readFile(source, 'utf8')).toBe(payload);
  }
});

it('does not clean a substituted directory or release its writer reservation', async () => {
  const pending = await stage();
  const directory = path.dirname(pending.outputPath);
  const retained = directory + '-retained';
  await fs.rename(directory, retained);
  await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, 'media.mp4'), 'replacement');
  await expect(pending.discard()).rejects.toThrow('CACHE_DIRECTORY_CHANGED');
  expect(await fs.readFile(path.join(directory, 'media.mp4'), 'utf8')).toBe(
    'replacement',
  );
  await fs.rm(directory, { recursive: true });
  await fs.rename(retained, directory);
  await pending.discard();
});

it('invalidates changed source/recipe/runtime or corrupt ready bytes without deleting them', async () => {
  const pending = await stage();
  await fs.writeFile(pending.outputPath, payload);
  await pending.seal(proof());
  const id = await pending.publish();
  const storage = await open();
  for (const different of [
    { ...expectation, recipe: 'new' },
    { ...expectation, runtime: 'new' },
    { ...expectation, source: { sha256: hash('new'), bytes: 3 } },
  ])
    expect(await storage.inspectCandidate(id, different)).toBeNull();
  const candidate = await storage.inspectCandidate(id, expectation);
  if (!candidate) throw Error('Missing candidate');
  await fs.writeFile(candidate.mediaPath, 'corrupt');
  await expect(storage.inspectCandidate(id, expectation)).rejects.toThrow(
    'CACHE_OUTPUT_CHANGED',
  );
  expect(await fs.readFile(candidate.mediaPath, 'utf8')).toBe('corrupt');
  await expect(
    storage.inspectCandidate('../escape', expectation),
  ).rejects.toThrow('CACHE_INVALID_CANDIDATE');
});

it('never replaces an existing publication destination', async () => {
  const pending = await stage();
  await fs.writeFile(pending.outputPath, payload);
  await pending.seal(proof());
  const id = path
    .basename(path.dirname(pending.outputPath))
    .slice('.pending-'.length);
  const ready = path.join(root, 'playback-cache-v1', `ready-${id}`);
  await fs.mkdir(ready);
  const before = await fs.lstat(ready, { bigint: true });
  await expect(pending.publish()).rejects.toThrow('CACHE_DESTINATION_EXISTS');
  await pending.discard();
  expect((await fs.lstat(ready, { bigint: true })).ino).toBe(before.ino);
});

it('requires the trusted proof to identify the actual output bytes', async () => {
  const pending = await stage();
  await fs.writeFile(pending.outputPath, payload);
  await expect(
    pending.seal({ ...proof(), outputSha256: hash('other-output') }),
  ).rejects.toThrow('CACHE_OUTPUT_CHANGED');
  await expect(pending.publish()).rejects.toThrow('CACHE_NOT_SEALED');
});
