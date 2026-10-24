import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheRangeReadOwner } from './cacheRangeReadLease';
import type { CacheRangeReadManifest } from './cacheRangeReadLease';
import { cacheFileRevision } from './cacheFileRevision';
const scope = {
  session: 's1',
  source: 'content+revision',
  worker: 'w1',
  build: 'build1',
  recipe: 'recipe1',
};
let directory: string, manifest: CacheRangeReadManifest;
const owners: CacheRangeReadOwner[] = [];
const owner = (
  current: () => Promise<void> = async () => undefined,
  limit = 64,
): CacheRangeReadOwner => {
  const o = new CacheRangeReadOwner(
    scope,
    new AbortController().signal,
    current,
    limit,
  );
  owners.push(o);
  return o;
};
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'range-read-test-'));
  const file = path.join(directory, 'media.bin'),
    bytes = Buffer.from('initmediapayload');
  await fs.writeFile(file, bytes);
  manifest = {
    scope: { ...scope },
    artifacts: [
      {
        path: file,
        bytes: bytes.length,
        revision: cacheFileRevision(await fs.lstat(file, { bigint: true })),
        ranges: [
          {
            id: 'initialization',
            offset: 0,
            bytes: 4,
            sha256: createHash('sha256')
              .update(bytes.subarray(0, 4))
              .digest('hex'),
          },
          {
            id: 0,
            offset: 4,
            bytes: bytes.length - 4,
            sha256: createHash('sha256')
              .update(bytes.subarray(4))
              .digest('hex'),
          },
        ],
      },
    ],
  };
});
afterEach(async () => {
  for (const o of owners.splice(0)) await o.close().catch(() => undefined);
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});
describe('CacheRangeReadOwner', () => {
  it('awaits verification, redeems once, permits repeat ID reads without sharing mutable bytes', async () => {
    const o = owner(),
      ticket = await o.prepare(async () => manifest),
      lease = await o.redeem(ticket);
    await expect(o.redeem(ticket)).rejects.toThrow('TICKET');
    const signal = new AbortController().signal;
    const first = new Uint8Array(await lease.read(0, signal));
    first.fill(0);
    expect(Buffer.from(await lease.read(0, signal)).toString()).toBe(
      'mediapayload',
    );
    expect(
      Buffer.from(await lease.read('initialization', signal)).toString(),
    ).toBe('init');
    await lease.close();
    expect(o.retainedBytes).toBe(0);
  });
  it('rejects forged/cross-Session tickets and changed scope or verifier failure', async () => {
    const a = owner(),
      b = owner(),
      ticket = await a.prepare(async () => manifest);
    await expect(b.redeem(ticket)).rejects.toThrow('TICKET');
    await expect(
      a.redeem({ kind: 'verified-range-read-ticket' }),
    ).rejects.toThrow('TICKET');
    await expect(
      a.prepare(async () => ({
        ...manifest,
        scope: { ...scope, session: 'other' },
      })),
    ).rejects.toThrow('MANIFEST');
    await expect(
      a.prepare(async () => {
        throw Error('FULL_PROOF_FAILED');
      }),
    ).rejects.toThrow('FULL_PROOF_FAILED');
  });
  it('copies proof descriptors before exposure to later mutation', async () => {
    const o = owner(),
      ticket = await o.prepare(async () => manifest);
    manifest.artifacts[0].ranges[1].sha256 = '0'.repeat(64);
    const lease = await o.redeem(ticket);
    expect(
      Buffer.from(await lease.read(0, new AbortController().signal)).toString(),
    ).toBe('mediapayload');
  });
  it('rejects invalid bounds, duplicate IDs and reservation undercount', async () => {
    for (const change of [
      () => {
        manifest.artifacts[0].ranges[1].offset = 999;
      },
      () => {
        manifest.artifacts[0].ranges[1].id = 'initialization';
      },
    ]) {
      const saved = structuredClone(manifest);
      change();
      await expect(owner().prepare(async () => manifest)).rejects.toThrow(
        'MANIFEST',
      );
      manifest = saved;
    }
    manifest.artifacts[0].bytes++;
    const o = owner(),
      ticket = await o.prepare(async () => manifest);
    await expect(o.redeem(ticket)).rejects.toThrow('CHANGED');
    expect(o.retainedBytes).toBe(0);
  });
  it('rejects content hash mismatch, then fails closed', async () => {
    manifest.artifacts[0].ranges[1].sha256 = '0'.repeat(64);
    const o = owner(),
      lease = await o.redeem(await o.prepare(async () => manifest));
    await expect(lease.read(0, new AbortController().signal)).rejects.toThrow(
      'HASH',
    );
    await expect(
      lease.read('initialization', new AbortController().signal),
    ).rejects.toThrow('UNAVAILABLE');
  });
  it('rejects path replacement and in-place changes before delivery', async () => {
    const o = owner(),
      lease = await o.redeem(await o.prepare(async () => manifest));
    await fs.rename(
      manifest.artifacts[0].path,
      path.join(directory, 'previous'),
    );
    await fs.writeFile(manifest.artifacts[0].path, 'initmediapayload');
    await expect(lease.read(0, new AbortController().signal)).rejects.toThrow(
      'CHANGED',
    );
  });
  it('revokes tickets and waits for in-flight scope check before closing a read', async () => {
    let release: () => void = () => {},
      hold = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const o = owner(async () => {
        if (hold) await gate;
      }),
      lease = await o.redeem(await o.prepare(async () => manifest));
    hold = true;
    const read = lease.read(0, new AbortController().signal);
    void read.catch(() => undefined);
    await Promise.resolve();
    let closed = false;
    const close = o.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(o.retainedBytes).toBeGreaterThan(0);
    release();
    await expect(read).rejects.toThrow();
    await close;
    expect(o.retainedBytes).toBe(0);
    await expect(lease.read(0, new AbortController().signal)).rejects.toThrow();
  });
  it('serializes reads and respects capacity before opening a second lease', async () => {
    const o = owner(async () => undefined, manifest.artifacts[0].bytes),
      lease = await o.redeem(await o.prepare(async () => manifest));
    const first = lease.read(0, new AbortController().signal);
    await expect(lease.read(0, new AbortController().signal)).rejects.toThrow(
      'BUSY',
    );
    await first;
    await expect(
      o.redeem(await o.prepare(async () => manifest)),
    ).rejects.toThrow('CAPACITY');
    await lease.close();
    expect(o.retainedBytes).toBe(0);
  });
  it('keeps reservations after close failure and never retries close implicitly', async () => {
    const open = fs.open.bind(fs);
    let actualClose: (() => Promise<void>) | undefined;
    const close = vi.fn(async () => {
      throw Error('CLOSE_FAILED');
    });
    vi.spyOn(fs, 'open').mockImplementation(async (file, flags, mode) => {
      const handle = await open(file, flags, mode);
      actualClose = handle.close.bind(handle);
      vi.spyOn(handle, 'close').mockImplementation(close);
      return handle;
    });
    const o = owner();
    await o.redeem(await o.prepare(async () => manifest));
    await expect(o.close()).rejects.toThrow('CLEANUP');
    await expect(o.close()).rejects.toThrow('CLEANUP');
    expect(close).toHaveBeenCalledTimes(1);
    expect(o.retainedBytes).toBe(manifest.artifacts[0].bytes);
    // Explicit test-only cleanup of this known fixture descriptor.
    await actualClose?.();
  });
  it('source invalidation during a pending read prevents delivery', async () => {
    let checks = 0,
      hold = false,
      invalidate = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const o = owner(async () => {
      if (hold && ++checks === 3) await gate;
      if (invalidate) throw Error('SOURCE_CHANGED');
    });
    const lease = await o.redeem(await o.prepare(async () => manifest));
    hold = true;
    const read = lease.read(0, new AbortController().signal);
    void read.catch(() => undefined);
    while (checks < 3) await new Promise((resolve) => setImmediate(resolve));
    invalidate = true;
    release();
    await expect(read).rejects.toThrow('SOURCE_CHANGED');
    await expect(lease.read(0, new AbortController().signal)).rejects.toThrow(
      'UNAVAILABLE',
    );
  });
  it.each(['abort', 'scope'])(
    'rejects %s during final open revision before ready ACK',
    async (kind) => {
      const abort = new AbortController();
      let invalid = false;
      const o = new CacheRangeReadOwner(scope, abort.signal, async () => {
        if (invalid) throw Error('STALE_SCOPE');
      });
      owners.push(o);
      const ticket = await o.prepare(async () => manifest);
      const handle = await fs.open(manifest.artifacts[0].path, 'r');
      const close = vi.spyOn(handle, 'close');
      vi.spyOn(fs, 'open').mockResolvedValueOnce(handle);
      const lstat = fs.lstat.bind(fs);
      let enter: () => void = () => {},
        release: () => void = () => {};
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(fs, 'lstat').mockImplementationOnce(async (...args) => {
        enter();
        await gate;
        return lstat(...args);
      });
      const ready = o.redeem(ticket);
      void ready.catch(() => undefined);
      await entered;
      if (kind === 'abort') abort.abort(Error('ABORTED'));
      else invalid = true;
      release();
      await expect(ready).rejects.toThrow(
        kind === 'abort' ? 'ABORTED' : 'STALE_SCOPE',
      );
      expect(close).toHaveBeenCalledTimes(1);
      expect(o.retainedBytes).toBe(0);
    },
  );
});
