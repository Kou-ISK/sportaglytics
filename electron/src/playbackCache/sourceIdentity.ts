import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import fs from 'node:fs/promises';
import type { CacheSourceIdentity } from './cachePolicy';

export const cacheFileRevision = (info: BigIntStats): string =>
  [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs, info.nlink].join(
    ':',
  );

const unchanged = (before: BigIntStats, after: BigIntStats): boolean =>
  before.dev === after.dev &&
  before.ino === after.ino &&
  before.size === after.size &&
  before.mtimeNs === after.mtimeNs &&
  before.ctimeNs === after.ctimeNs &&
  before.nlink === after.nlink;

/** Read-only identity for an already authorized, closed local media file.
 * Main must still validate Session ownership and exclude recording/blob sources.
 * No sampled digest or metadata-only result is accepted as a source identity. */
export const readCacheFileIdentity = async (
  source: string,
  options: {
    signal?: AbortSignal;
    progress?: (bytes: number, total: number) => void;
  } = {},
): Promise<{ identity: CacheSourceIdentity; revision: string }> => {
  options.signal?.throwIfAborted();
  const before = await fs.lstat(source, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new Error('CACHE_INVALID_SOURCE');
  const handle = await fs.open(
    source,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    if (!unchanged(before, await handle.stat({ bigint: true })))
      throw new Error('CACHE_SOURCE_CHANGED');
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytes = 0;
    while (true) {
      options.signal?.throwIfAborted();
      const read = await handle.read(buffer, 0, buffer.length, bytes);
      options.signal?.throwIfAborted();
      if (read.bytesRead === 0) break;
      bytes += read.bytesRead;
      if (BigInt(bytes) > before.size) throw new Error('CACHE_SOURCE_CHANGED');
      digest.update(buffer.subarray(0, read.bytesRead));
      // A detached progress observer cannot alter identity or strand the handle.
      try {
        options.progress?.(bytes, Number(before.size));
      } catch {
        // Progress is advisory; the read/identity checks remain authoritative.
      }
    }
    options.signal?.throwIfAborted();
    const after = await handle.stat({ bigint: true });
    const located = await fs.lstat(source, { bigint: true });
    if (
      BigInt(bytes) !== before.size ||
      !located.isFile() ||
      !unchanged(before, after) ||
      !unchanged(before, located)
    )
      throw new Error('CACHE_SOURCE_CHANGED');
    options.signal?.throwIfAborted();
    return {
      identity: { sha256: digest.digest('hex'), bytes },
      revision: cacheFileRevision(after),
    };
  } finally {
    await handle.close();
  }
};

export const identifyCacheSource = async (
  source: string,
  options: Parameters<typeof readCacheFileIdentity>[1] = {},
): Promise<CacheSourceIdentity> =>
  (await readCacheFileIdentity(source, options)).identity;
