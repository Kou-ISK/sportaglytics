import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reusePlaybackCache } from './cacheReusePipeline';
import { openPlaybackCacheStorage } from './cacheStorage';
import { CACHE_RECIPE } from './cacheRecipe';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheExpectation, CacheValidation } from './cachePolicy';
import type { CachePreparationOptions } from './cacheRuntimePipeline';
import type { PlaybackCacheJob } from './cacheJob';

const mocks = vi.hoisted(() => ({
  root: '',
  runtime: 'test-runtime',
  metadata: vi.fn(),
  timing: vi.fn(),
  hardware: vi.fn(),
  spawn: vi.fn(),
}));
vi.mock('electron', () => ({ app: { getPath: () => mocks.root } }));
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
      configurationSha256: digest('full audio configuration'),
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
  mocks.runtime = 'test-runtime';
  mocks.metadata.mockReset().mockResolvedValue(metadata);
  mocks.timing.mockReset().mockResolvedValue(structuredClone(expected.timing));
  mocks.spawn.mockReset().mockImplementation(() => {
    throw Error('Conversion must not start');
  });
  mocks.hardware.mockReset().mockResolvedValue({
    ...validation.hardware,
    probe: {
      ended: true,
      frames: 24,
      maximumTime: 0.99,
      elapsedMs: 1000,
      properties: [],
    },
  });
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
