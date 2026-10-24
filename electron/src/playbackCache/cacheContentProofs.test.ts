import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CacheContentProofs } from './cacheContentProofs';
import type { CacheProbeContext } from './cacheProbe';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheTimingProof } from './cachePolicy';

const probe = vi.hoisted(() => ({ metadata: vi.fn(), timing: vi.fn() }));
vi.mock('./cacheProbe', () => ({
  probeCacheMetadata: probe.metadata,
  probeCacheTiming: probe.timing,
}));
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
  ],
});
const timing: CacheTimingProof = {
  fpsNumerator: 24,
  fpsDenominator: 1,
  displayFrames: 24,
  endNumerator: 1,
  endDenominator: 1,
  displayIntervalsSha256: 'a'.repeat(64),
  audio: [],
};
let root: string;
let source: string;
let memo: CacheContentProofs;
let abort: AbortController;
const context = () => ({
  executable: '/app/ffprobe',
  signal: abort.signal,
  stopWaiting: () => undefined,
});
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'content-proof-'));
  source = path.join(root, 'source.mp4');
  await fs.writeFile(source, 'original');
  memo = new CacheContentProofs();
  abort = new AbortController();
  probe.metadata
    .mockReset()
    .mockImplementation(async () => structuredClone(metadata));
  probe.timing
    .mockReset()
    .mockImplementation(async () => structuredClone(timing));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it('uses a whole-byte identity and only remembers explicitly qualified complete proofs', async () => {
  const cold = await memo.read(source, context(), 'runtime');
  expect(cold.identity.sha256).toBe(
    createHash('sha256').update('original').digest('hex'),
  );
  expect(cold.observation.reused).toBe(false);
  expect(
    (await memo.read(source, context(), 'runtime')).observation.reused,
  ).toBe(false);
  cold.remember();
  const warm = await memo.read(source, context(), 'runtime');
  expect(warm.observation.reused).toBe(true);
  expect(warm.timing).toEqual(timing);
  expect(probe.timing).toHaveBeenCalledTimes(2);
});
it('re-hashes same-size edits even when mtime is restored and rejects missing or linked input', async () => {
  (await memo.read(source, context(), 'runtime')).remember();
  const before = await fs.stat(source);
  await fs.writeFile(source, 'modified');
  await fs.utimes(source, before.atime, before.mtime);
  expect(
    (await memo.read(source, context(), 'runtime')).observation.reused,
  ).toBe(false);
  await fs.unlink(source);
  await expect(memo.read(source, context(), 'runtime')).rejects.toThrow();
  const other = path.join(root, 'other');
  await fs.writeFile(other, 'original');
  await fs.symlink(other, source);
  await expect(memo.read(source, context(), 'runtime')).rejects.toThrow(
    'CACHE_INVALID_SOURCE',
  );
});
it('rejects a changed revision between probe and digest even if bytes are restored', async () => {
  probe.timing.mockImplementationOnce(async () => {
    const replacement = path.join(root, 'replacement');
    await fs.writeFile(replacement, 'original');
    await fs.rename(replacement, source);
    return timing;
  });
  await expect(memo.read(source, context(), 'runtime')).rejects.toThrow(
    'CACHE_CONTENT_CHANGED',
  );
  expect(
    (await memo.read(source, context(), 'runtime')).observation.reused,
  ).toBe(false);
});
it('does not remember probe failures, aborted late results or a cancelled commit', async () => {
  probe.timing.mockRejectedValueOnce(Error('decode failed'));
  await expect(memo.read(source, context(), 'runtime')).rejects.toThrow(
    'decode failed',
  );
  probe.timing.mockImplementationOnce(async () => {
    abort.abort();
    return timing;
  });
  await expect(memo.read(source, context(), 'runtime')).rejects.toThrow();
  abort = new AbortController();
  const cold = await memo.read(source, context(), 'runtime');
  expect(cold.observation.reused).toBe(false);
  abort.abort();
  expect(() => cold.remember()).toThrow();
  abort = new AbortController();
  expect(
    (await memo.read(source, context(), 'runtime')).observation.reused,
  ).toBe(false);
});
it('isolates returned objects and misses on runtime change or Main restart', async () => {
  const cold = await memo.read(source, context(), 'runtime');
  cold.remember();
  cold.timing.displayFrames = 1;
  const warm = await memo.read(source, context(), 'runtime');
  expect(warm.timing.displayFrames).toBe(24);
  warm.metadata.video.width = 1;
  warm.timing.displayFrames = 2;
  expect(
    (await memo.read(source, context(), 'runtime')).metadata.video.width,
  ).toBe(320);
  expect(
    (await memo.read(source, context(), 'changed-runtime')).observation.reused,
  ).toBe(false);
  expect(
    (await new CacheContentProofs().read(source, context(), 'runtime'))
      .observation.reused,
  ).toBe(false);
});
it('bounds retained proofs to eight with least-recently-used eviction', async () => {
  for (let index = 0; index < 8; index++)
    (await memo.read(source, context(), String(index))).remember();
  expect((await memo.read(source, context(), '0')).observation.reused).toBe(
    true,
  );
  (await memo.read(source, context(), '8')).remember();
  expect((await memo.read(source, context(), '1')).observation.reused).toBe(
    false,
  );
  expect((await memo.read(source, context(), '0')).observation.reused).toBe(
    true,
  );
});
it('does not share cancellation across concurrent callers for identical bytes', async () => {
  const second = new AbortController();
  probe.timing.mockImplementation(
    async (
      _source: string,
      _metadata: unknown,
      callContext: CacheProbeContext,
    ) => {
      if (callContext.signal === abort.signal) abort.abort();
      return structuredClone(timing);
    },
  );
  const results = await Promise.allSettled([
    memo.read(source, context(), 'runtime'),
    memo.read(source, { ...context(), signal: second.signal }, 'runtime'),
  ]);
  expect(results[0].status).toBe('rejected');
  expect(results[1].status).toBe('fulfilled');
  if (results[1].status === 'fulfilled') results[1].value.remember();
  abort = new AbortController();
  expect(
    (await memo.read(source, context(), 'runtime')).observation.reused,
  ).toBe(true);
});
