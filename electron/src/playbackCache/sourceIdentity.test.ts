import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it as itOnAnyHost,
} from 'vitest';
import { identifyCacheSource } from './sourceIdentity';
// Real POSIX descriptor/ownership contracts for the Mac-only cache path.
// Windows keeps the unsupported-platform and pure/IPC regressions.
const it = itOnAnyHost.skipIf(process.platform === 'win32');

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-identity-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('cache source identity', () => {
  it('hashes every byte, reports monotone byte progress, and leaves input unchanged', async () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 11, 5);
    bytes[bytes.length - 1] = 9;
    const source = path.join(root, 'source.bin');
    await fs.writeFile(source, bytes);
    const progress: { read: number; total: number }[] = [];
    const identity = await identifyCacheSource(source, {
      progress: (read, total) => {
        progress.push({ read, total });
      },
    });
    expect(identity).toEqual({
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    });
    expect(progress).toEqual(
      [1024 * 1024, 2 * 1024 * 1024, bytes.length].map((read) => ({
        read,
        total: bytes.length,
      })),
    );
    expect((await fs.readFile(source)).equals(bytes)).toBe(true);
  });

  it('rejects empty, directory and symlink inputs without changing the target', async () => {
    const source = path.join(root, 'source.bin');
    const link = path.join(root, 'link');
    await fs.writeFile(source, 'original');
    await fs.symlink(source, link);
    await expect(identifyCacheSource(link)).rejects.toThrow(
      'CACHE_INVALID_SOURCE',
    );
    await expect(identifyCacheSource(root)).rejects.toThrow(
      'CACHE_INVALID_SOURCE',
    );
    await fs.writeFile(path.join(root, 'empty'), '');
    await expect(identifyCacheSource(path.join(root, 'empty'))).rejects.toThrow(
      'CACHE_INVALID_SOURCE',
    );
    expect(await fs.readFile(source, 'utf8')).toBe('original');
  });

  it('does not open a source when cancelled and stops a read at the next chunk', async () => {
    const cancelled = AbortSignal.abort();
    await expect(
      identifyCacheSource(path.join(root, 'missing'), { signal: cancelled }),
    ).rejects.toThrow();
    const source = path.join(root, 'large.bin');
    await fs.writeFile(source, Buffer.alloc(3 * 1024 * 1024));
    const controller = new AbortController();
    let progressCount = 0;
    await expect(
      identifyCacheSource(source, {
        signal: controller.signal,
        progress: () => {
          progressCount += 1;
          controller.abort();
        },
      }),
    ).rejects.toThrow();
    expect(progressCount).toBe(1);
    // The handle is closed, including the cancellation branch.
    await fs.rename(source, path.join(root, 'renamed.bin'));
  });

  it('rejects an input replaced during reading even when its bytes and size match', async () => {
    const source = path.join(root, 'source.bin');
    const replacement = path.join(root, 'replacement.bin');
    const bytes = Buffer.alloc(1024 * 1024 + 5, 2);
    await fs.writeFile(source, bytes);
    await fs.writeFile(replacement, bytes);
    let replaced = false;
    // Replace synchronously at the first progress boundary.
    const { renameSync } = await import('node:fs');
    await expect(
      identifyCacheSource(source, {
        progress: () => {
          if (replaced) return;
          renameSync(replacement, source);
          replaced = true;
        },
      }),
    ).rejects.toThrow('CACHE_SOURCE_CHANGED');
  });

  it('does not let a throwing progress observer corrupt a completed identity', async () => {
    const source = path.join(root, 'source.bin');
    await fs.writeFile(source, 'sample');
    expect(
      (
        await identifyCacheSource(source, {
          progress: () => {
            throw Error('gone');
          },
        })
      ).bytes,
    ).toBe(6);
  });
});
