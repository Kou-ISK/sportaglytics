import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reusePlaybackCache } from './cacheReusePipeline';
import { openPlaybackCacheStorage } from './cacheStorage';
import { CACHE_RECIPE } from './cacheRecipe';
import {
  parseCacheMediaMetadata,
  mediaConfigurationHash,
} from './cacheMediaMetadata';
import { CacheProofStore } from './cacheProofStore';
import type { CacheExpectation, CacheValidation } from './cachePolicy';
import { preparePlaybackCache } from './cacheRuntimePipeline';
import type { CachePreparationOptions } from './cacheRuntimePipeline';
import type { CacheWorkerEvents } from './cacheConversionRunner';
import type { PlaybackCacheJob } from './cacheJob';

const mocks = vi.hoisted(() => ({
  root: '',
  runtime: 'test-runtime',
  metadata: vi.fn(),
  timing: vi.fn(),
  hardware: vi.fn(),
  spawn: vi.fn(),
}));
vi.mock('electron', () => ({
  app: {
    getPath: () => mocks.root,
    getAppPath: () => mocks.root + '/synthetic.asar',
  },
}));
vi.mock('./cacheApplicationIdentity', async () => {
  const actual = await vi.importActual<
    typeof import('./cacheApplicationIdentity')
  >('./cacheApplicationIdentity');
  const native = await import('node:fs');
  return {
    readCacheApplicationIdentity: (file: string, signal: AbortSignal) =>
      actual.readCacheApplicationIdentity(file, signal, native),
    isCacheApplicationCurrent: (
      value: import('./cacheApplicationIdentity').CacheApplicationIdentity,
      signal: AbortSignal,
    ) => actual.isCacheApplicationCurrent(value, signal, native),
  };
});
vi.mock('./cacheBundledTools', () => ({
  identifyCacheTools: async () => ({
    ffmpeg: '/app/ffmpeg',
    ffprobe: '/app/ffprobe',
    runtime: mocks.runtime,
  }),
}));
// These tests exercise the real reuse/job/storage/validation wiring. Media decode
// and the isolated HW window are simulated; filesystem/hash checks are real.
vi.mock('./cacheSourceAccess', () => ({
  assertClosedMp4: async () => undefined,
}));
vi.mock('./cacheProbe', () => ({
  probeCacheMetadata: mocks.metadata,
  probeCacheTiming: mocks.timing,
}));
vi.mock('./cacheHardwareProbe', () => ({ probeCacheHardware: mocks.hardware }));
vi.mock('./cacheWorkerProcess', () => ({ spawnCacheWorker: mocks.spawn }));
vi.mock('./cacheRecipe', async () => {
  const actual = await vi.importActual<typeof import('./cacheRecipe')>(
    './cacheRecipe',
  );
  return {
    ...actual,
    // The worker and HW decoder are simulated above. Exercise the real Mac
    // recipe on every CI host; unsupported-host rejection has separate coverage.
    buildCacheRecipe: (...args: Parameters<typeof actual.buildCacheRecipe>) =>
      actual.buildCacheRecipe(args[0], args[1], args[2], 'darwin'),
  };
});

const digest = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const inputBytes = 'original input';
const outputBytes = 'existing immutable candidate';
const metadata = parseCacheMediaMetadata({
  streams: [
    {
      index: 0,
      codec_type: 'video',
      codec_name: 'h264',
      time_base: '1/24',
      start_pts: 0,
      duration_ts: 24,
      width: 320,
      height: 180,
      pix_fmt: 'yuv420p',
      field_order: 'progressive',
      avg_frame_rate: '24/1',
      disposition: {},
    },
    ...[1, 2, 3].map((index) => ({
      index,
      codec_type: 'audio',
      codec_name: 'aac',
      time_base: '1/48000',
      start_pts: 0,
      duration_ts: 48000,
      avg_frame_rate: '0/0',
      sample_rate: '48000',
      channels: 2,
      channel_layout: 'stereo',
      extradata_hash: 'SHA256:' + digest(String(index)),
      disposition: { default: index === 1 ? 1 : 0 },
    })),
  ],
});
const expected: CacheExpectation = {
  source: { sha256: digest(inputBytes), bytes: Buffer.byteLength(inputBytes) },
  recipe: CACHE_RECIPE,
  runtime: 'test-runtime',
  timing: {
    fpsNumerator: 24,
    fpsDenominator: 1,
    displayFrames: 24,
    endNumerator: 1,
    endDenominator: 1,
    displayIntervalsSha256: digest('full frame times'),
    audio: [1, 2, 3].map((streamIndex) => ({
      streamIndex,
      codec: 'aac',
      packets: 48,
      timesSha256: digest('full audio times'),
      payloadSha256: digest('full audio payload'),
      configurationSha256: mediaConfigurationHash(
        metadata.audio[streamIndex - 1],
      ),
    })),
  },
};
const validation: CacheValidation = {
  outputBytes: Buffer.byteLength(outputBytes),
  outputSha256: digest(outputBytes),
  sourceAfter: expected.source,
  recipe: CACHE_RECIPE,
  timing: expected.timing,
  hardware: {
    coverage: { mode: 'full', ended: true },
    runtime: expected.runtime,
    platformDecoder: true,
    softwareFallback: false,
  },
};
let options: CachePreparationOptions;
let savedPath: string;
let retainedJob: PlaybackCacheJob | undefined;
beforeEach(async () => {
  mocks.root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'cache-reuse-')),
  );
  await fs.writeFile(
    path.join(mocks.root, 'synthetic.asar'),
    'synthetic app identity',
  );
  mocks.runtime = 'test-runtime-' + randomUUID();
  expected.runtime = mocks.runtime;
  validation.hardware.runtime = mocks.runtime;
  mocks.metadata.mockReset().mockResolvedValue(metadata);
  mocks.timing.mockReset().mockResolvedValue(structuredClone(expected.timing));
  mocks.spawn.mockReset().mockImplementation(() => {
    throw Error('Conversion must not start');
  });
  mocks.hardware.mockReset().mockImplementation(async (...args: unknown[]) => ({
    ...validation.hardware,
    coverage:
      args[6] === 'full'
        ? { mode: 'full', ended: true }
        : {
            mode: 'compatibility',
            duration: 1,
            presentationEnd: 1,
            segments: [
              {
                start: 0,
                end: 1,
                firstClock: 0,
                lastClock: 0.99,
                first: 0,
                last: 0.99,
                frames: 24,
                ended: true,
              },
            ],
          },
    probe: {
      ended: args[6] === 'full',
      frames: 24,
      maximumTime: 0.99,
      elapsedMs: 1000,
      properties: [],
    },
  }));
  const sourcePath = path.join(mocks.root, 'source.mp4');
  await fs.writeFile(sourcePath, inputBytes);
  const storage = await openPlaybackCacheStorage(mocks.root, {
    maximumCacheBytes: 1024 * 1024,
    reserveBytes: 0,
  });
  const staging = await storage.begin(expected, 1024);
  await fs.writeFile(staging.outputPath, outputBytes);
  await staging.seal(validation);
  const id = await staging.publish();
  savedPath = path.join(
    mocks.root,
    'playback-cache-v1',
    'ready-' + id,
    'media.mp4',
  );
  retainedJob = undefined;
  options = {
    source: {
      path: sourcePath,
      key: digest('key'),
      url: 'file://' + sourcePath,
      label: 'synthetic',
      revision: 'initial',
      bytes: Buffer.byteLength(inputBytes),
      assertCurrent: vi.fn(async () => undefined),
    },
    signal: new AbortController().signal,
    assertOwner: vi.fn(async () => undefined),
    notify: vi.fn(),
    retainJob: (job) => {
      retainedJob = job;
    },
  };
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(mocks.root, { recursive: true, force: true });
});

it('recomputes source/output proofs and HW before exposing the existing immutable candidate', async () => {
  const artifact = await reusePlaybackCache(options);
  expect(mocks.metadata.mock.calls.map((call) => call[0])).toEqual([
    options.source.path,
    savedPath,
  ]);
  expect(mocks.timing.mock.calls.map((call) => call[0])).toEqual([
    options.source.path,
    savedPath,
  ]);
  expect(mocks.hardware.mock.calls[0][0]).toBe(savedPath);
  expect(mocks.hardware.mock.calls[0][1]).toBe(mocks.root);
  expect(artifact.evidence.mode).toBe('reused');
  expect(artifact.evidence.conversion).toBeNull();
  expect(artifact.evidence.validation.timing).toEqual(expected.timing);
  expect(artifact.job.status).toMatchObject({
    phase: 'ready',
    selected: 'original',
  });
  expect(artifact.audioTracks).toBe(3);
  expect(mocks.spawn).not.toHaveBeenCalled();
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
  expect(await fs.readFile(options.source.path, 'utf8')).toBe(inputBytes);
});

it('does not reuse a prior runtime or turn missing candidates into generation', async () => {
  mocks.runtime = 'changed-runtime';
  await expect(reusePlaybackCache(options)).rejects.toThrow(
    'CACHE_CANDIDATE_NOT_FOUND',
  );
  expect(mocks.hardware).not.toHaveBeenCalled();
  expect(mocks.spawn).not.toHaveBeenCalled();
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
});

it.each(['audio', 'hardware', 'output', 'source'])(
  'rejects altered %s through real reuse validation and preserves ready media',
  async (change) => {
    if (change === 'audio') {
      const altered = structuredClone(expected.timing);
      altered.audio = altered.audio.map((track) => ({
        ...track,
        payloadSha256: digest('altered'),
      }));
      mocks.timing
        .mockResolvedValueOnce(expected.timing)
        .mockResolvedValueOnce(altered);
    } else if (change === 'hardware')
      mocks.hardware.mockRejectedValue(Error('CACHE_HARDWARE_UNCONFIRMED'));
    else
      mocks.hardware.mockImplementation(async () => {
        await fs.writeFile(
          change === 'output' ? savedPath : options.source.path,
          'changed',
        );
        return {
          ...validation.hardware,
          probe: {
            ended: true,
            frames: 24,
            maximumTime: 0.99,
            elapsedMs: 1000,
            properties: [],
          },
        };
      });
    // The real source adapter rejects revision changes; model that ownership guard.
    if (change === 'source')
      options.source.assertCurrent = async () => {
        if ((await fs.readFile(options.source.path, 'utf8')) !== inputBytes)
          throw Error('CACHE_SOURCE_CHANGED');
      };
    await expect(reusePlaybackCache(options)).rejects.toThrow(
      'CACHE_REUSE_FAILED',
    );
    expect(retainedJob?.selectCache(true)).toBeNull();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(await fs.stat(savedPath)).toBeDefined();
  },
);

it('retains failed probe cleanup for retry without deleting the ready candidate', async () => {
  let failing = true;
  const cleanup = vi.fn(async () => {
    if (failing) throw Error('cleanup');
  });
  mocks.hardware.mockImplementation(
    async (_path, _directory, _runtime, _signal, _waiting, retain) => {
      retain(cleanup);
      throw Error('probe failed');
    },
  );
  await expect(reusePlaybackCache(options)).rejects.toThrow(
    'CACHE_REUSE_FAILED',
  );
  expect(retainedJob?.status.error).toBe('cleanup');
  failing = false;
  await retainedJob?.retryCleanup();
  expect(retainedJob?.status.phase).toBe('original');
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
});

it.each(['field', 'frame-count', 'audio-time', 'audio-payload', 'source'])(
  'rejects mismatched %s before starting the full hardware probe',
  async (change) => {
    const altered = structuredClone(expected.timing);
    if (change === 'field') altered.displayIntervalsSha256 = digest('shifted');
    if (change === 'frame-count') altered.displayFrames--;
    if (change === 'audio-time')
      altered.audio = altered.audio.map((track) => ({
        ...track,
        timesSha256: digest('shifted'),
      }));
    if (change === 'audio-payload')
      altered.audio = altered.audio.map((track) => ({
        ...track,
        payloadSha256: digest('altered'),
      }));
    mocks.timing
      .mockResolvedValueOnce(expected.timing)
      .mockImplementationOnce(async () => {
        if (change === 'source')
          await fs.writeFile(options.source.path, 'changed input');
        return altered;
      });
    await expect(reusePlaybackCache(options)).rejects.toThrow(
      'CACHE_REUSE_FAILED',
    );
    expect(mocks.hardware).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(retainedJob?.selectCache(true)).toBeNull();
    expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
  },
);

it('reuses qualified Main-memory content proofs but repeats HW and ownership checks', async () => {
  const first = await reusePlaybackCache(options);
  expect(first.evidence.sourceProof.reused).toBe(false);
  const second = await reusePlaybackCache(options);
  expect(second.evidence.sourceProof.reused).toBe(true);
  expect(mocks.metadata).toHaveBeenCalledTimes(2);
  expect(mocks.timing).toHaveBeenCalledTimes(2);
  expect(mocks.hardware).toHaveBeenCalledTimes(2);
  expect(options.assertOwner).toHaveBeenCalled();
  expect(options.source.assertCurrent).toHaveBeenCalled();
  expect(second.evidence.validation.timing).toEqual(expected.timing);
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
});
it('does not let a warm proof bypass a later hardware failure or owner change', async () => {
  await reusePlaybackCache(options);
  mocks.hardware.mockRejectedValueOnce(Error('HW unavailable'));
  await expect(reusePlaybackCache(options)).rejects.toThrow(
    'CACHE_REUSE_FAILED',
  );
  expect(retainedJob?.selectCache(true)).toBeNull();
  options.assertOwner = async () => {
    throw Error('owner changed');
  };
  await expect(reusePlaybackCache(options)).rejects.toThrow('owner changed');
});
it('rejects a candidate replaced with identical bytes during HW qualification', async () => {
  mocks.hardware.mockImplementationOnce(async () => {
    const replacement = path.join(mocks.root, 'replacement');
    await fs.writeFile(replacement, outputBytes);
    await fs.rename(replacement, savedPath);
    return {
      ...validation.hardware,
      probe: {
        ended: true,
        frames: 24,
        maximumTime: 0.99,
        elapsedMs: 1000,
        properties: [],
      },
    };
  });
  await expect(reusePlaybackCache(options)).rejects.toThrow(
    'CACHE_REUSE_FAILED',
  );
  expect(retainedJob?.selectCache(true)).toBeNull();
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
});

it('shares qualified content from creation with reuse without converting again', async () => {
  mocks.spawn.mockImplementation(
    (_executable: string, args: string[], events: CacheWorkerEvents) => {
      const output = args.at(-1);
      if (!output) throw Error('output missing');
      void fs.writeFile(output, outputBytes).then(
        () => events.closed(0, null),
        () => events.closed(1, null),
      );
      return { terminate: () => false, dispose: () => undefined };
    },
  );
  const created = await preparePlaybackCache(options);
  expect(created.evidence.mode).toBe('created');
  expect(created.evidence.sourceProof.reused).toBe(false);
  const reused = await reusePlaybackCache(options);
  expect(reused.evidence.sourceProof.reused).toBe(true);
  expect(mocks.metadata).toHaveBeenCalledTimes(2);
  expect(mocks.timing).toHaveBeenCalledTimes(2);
  expect(mocks.hardware).toHaveBeenCalledTimes(2);
  expect(mocks.spawn).toHaveBeenCalledTimes(1);
  expect(reused.evidence.validation.timing).toEqual(
    created.evidence.validation.timing,
  );
});

it.each(['owner', 'source', 'cancel'])(
  'rechecks %s after awaited optional proof persistence',
  async (change) => {
    const cancel = new AbortController();
    options.signal = cancel.signal;
    vi.spyOn(CacheProofStore.prototype, 'write').mockImplementationOnce(
      async () => {
        await Promise.resolve();
        if (change === 'owner')
          vi.mocked(options.assertOwner).mockRejectedValue(
            Error('owner changed'),
          );
        if (change === 'source')
          options.source.assertCurrent = async () => {
            throw Error('source changed');
          };
        if (change === 'cancel') cancel.abort();
        return 'not-stored';
      },
    );
    await expect(reusePlaybackCache(options)).rejects.toThrow();
    expect(retainedJob?.selectCache(true)).toBeNull();
    expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
  },
);
it('reuses disk proof after a module restart but rejects fresh hardware failure', async () => {
  vi.resetModules();
  const first = await import('./cacheReusePipeline');
  const cold = await first.reusePlaybackCache(options);
  expect(cold.evidence.sourceProof.persistence).toBe('stored');
  expect(cold.evidence.validation.contentProof.persistence).toBe('stored');
  vi.resetModules();
  const next = await import('./cacheReusePipeline');
  mocks.timing.mockClear();
  mocks.metadata.mockClear();
  mocks.hardware.mockRejectedValueOnce(Error('new HW failed'));
  await expect(next.reusePlaybackCache(options)).rejects.toThrow(
    'CACHE_REUSE_FAILED',
  );
  expect(mocks.timing).not.toHaveBeenCalled();
  expect(mocks.metadata).not.toHaveBeenCalled();
  expect(retainedJob?.selectCache(true)).toBeNull();
  const ready = await next.reusePlaybackCache(options);
  expect(ready.evidence.sourceProof.from).toBe('persistent');
  expect(ready.evidence.validation.contentProof.from).toBe('persistent');
  expect(mocks.hardware).toHaveBeenCalledTimes(3);
});

it('records complete digest reads for fresh and warm reuse without a repeated initial candidate hash', async () => {
  const open = fs.open.bind(fs);
  const actualReads: { path: string; bytes: number }[] = [];
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    if (args[0] === savedPath || args[0] === options.source.path) {
      const read = handle.read.bind(handle);
      const record = { path: String(args[0]), bytes: 0 };
      actualReads.push(record);
      vi.spyOn(handle, 'read').mockImplementation(async (...readArgs) => {
        const result = await read(...readArgs);
        record.bytes += result.bytesRead;
        return result;
      });
    }
    return handle;
  });
  for (const [sourcePasses, candidatePasses] of [
    [3, 4],
    [2, 3],
  ]) {
    actualReads.length = 0;
    const result = await reusePlaybackCache(options);
    const evidence = result.evidence.mediaReads;
    expect(evidence?.overflow).toBe(false);
    expect(evidence?.records.every((r) => r.verified)).toBe(true);
    const sources = evidence?.records.filter((r) => r.role === 'source') ?? [];
    const candidates =
      evidence?.records.filter((r) => r.role === 'candidate') ?? [];
    expect(sources).toHaveLength(sourcePasses);
    expect(candidates).toHaveLength(candidatePasses);
    expect(sources.reduce((n, r) => n + r.bytes, 0)).toBe(
      sourcePasses * inputBytes.length,
    );
    expect(candidates.reduce((n, r) => n + r.bytes, 0)).toBe(
      candidatePasses * outputBytes.length,
    );
    expect(
      actualReads
        .filter((r) => r.path === options.source.path)
        .map((r) => r.bytes),
    ).toEqual(Array(sourcePasses).fill(inputBytes.length));
    expect(
      actualReads.filter((r) => r.path === savedPath).map((r) => r.bytes),
    ).toEqual(Array(candidatePasses).fill(outputBytes.length));
  }
});
it('owns an unconfirmed handoff close in Job cleanup and retries only on explicit cleanup', async () => {
  const open = fs.open.bind(fs);
  let first = true;
  const closeCalls = vi.fn();
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    if (args[0] === savedPath && first) {
      first = false;
      const close = handle.close.bind(handle);
      vi.spyOn(handle, 'close')
        .mockImplementationOnce(async () => {
          closeCalls();
          throw Error('close unconfirmed');
        })
        .mockImplementation(async () => {
          closeCalls();
          await close();
        });
    }
    return handle;
  });
  await expect(reusePlaybackCache(options)).rejects.toThrow(
    'close unconfirmed',
  );
  expect(closeCalls).toHaveBeenCalledTimes(1);
  expect(retainedJob?.status.error).toBe('cleanup');
  expect(retainedJob?.selectCache(true)).toBeNull();
  expect(mocks.hardware).not.toHaveBeenCalled();
  await retainedJob?.retryCleanup();
  expect(closeCalls).toHaveBeenCalledTimes(2);
  expect(retainedJob?.status.phase).toBe('original');
  expect(await fs.readFile(savedPath, 'utf8')).toBe(outputBytes);
});
