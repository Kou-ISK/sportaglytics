import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { identifyCacheTools } from './cacheBundledTools';
import { CacheProofStore } from './cacheProofStore';
import { openCacheProofDirectory } from './cacheProofIo';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';

const appPath = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: appPath },
}));
afterEach(() => vi.clearAllMocks());

it.skipIf(process.platform === 'darwin')(
  'rejects unsupported cache hosts before resolving or reading bundled helpers',
  async () => {
    await expect(
      identifyCacheTools(new AbortController().signal),
    ).rejects.toThrow('CACHE_PLATFORM_UNSUPPORTED');
    expect(appPath).not.toHaveBeenCalled();
  },
);

it.skipIf(process.platform !== 'win32')(
  'does not create or adopt private proofs without POSIX owner protections',
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-unsupported-'));
    try {
      const signal = new AbortController().signal;
      const store = new CacheProofStore(
        () => root,
        async () => 'synthetic-build',
      );
      await expect(openCacheProofDirectory(root, signal)).rejects.toThrow(
        'CACHE_PROOF_PARENT',
      );
      expect(await store.read('a'.repeat(64), signal)).toBeNull();
      const metadata = parseCacheMediaMetadata({
        streams: [
          {
            index: 0,
            codec_type: 'video',
            codec_name: 'h264',
            time_base: '1/24',
            start_pts: 0,
            duration_ts: 24,
            avg_frame_rate: '24/1',
            width: 320,
            height: 180,
            pix_fmt: 'yuv420p',
            field_order: 'progressive',
            disposition: {},
          },
        ],
      });
      expect(
        await store.write(
          'a'.repeat(64),
          {
            metadata,
            timing: {
              fpsNumerator: 24,
              fpsDenominator: 1,
              displayFrames: 24,
              endNumerator: 1,
              endDenominator: 1,
              displayIntervalsSha256: 'b'.repeat(64),
              audio: [],
            },
          },
          signal,
        ),
      ).toBe('not-stored');
      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
