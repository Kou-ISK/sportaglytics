import { createHash } from 'node:crypto';
import type fs from 'node:fs';
import { cacheFileRevision } from './sourceIdentity';
// Electron declares original-fs as the Node fs contract. Load lazily so pure
// tests can supply a native filesystem without changing global process.noAsar.
declare const require: (module: 'original-fs') => typeof fs;
export interface CacheApplicationIdentity {
  path: string;
  revision: string;
  scope: string;
}
export const readCacheApplicationIdentity = async (
  file: string,
  signal: AbortSignal,
  native: typeof fs = require('original-fs'),
): Promise<CacheApplicationIdentity | null> => {
  signal.throwIfAborted();
  if (!file.endsWith('.asar')) return null;
  const step = async <T>(work: () => Promise<T>): Promise<T> => {
    signal.throwIfAborted();
    const value = await work();
    signal.throwIfAborted();
    return value;
  };
  const io = native.promises,
    before = await step(() => io.lstat(file, { bigint: true }));
  signal.throwIfAborted();
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size <= 0n ||
    before.size > 256n * 1024n * 1024n ||
    (await step(() => io.realpath(file))) !== file
  )
    return null;
  signal.throwIfAborted();
  const handle = await io.open(
    file,
    native.constants.O_RDONLY | native.constants.O_NOFOLLOW,
  );
  try {
    signal.throwIfAborted();
    const revision = cacheFileRevision(before);
    if (
      cacheFileRevision(await step(() => handle.stat({ bigint: true }))) !==
      revision
    )
      throw Error('CACHE_APP_CHANGED');
    const hash = createHash('sha256'),
      buffer = Buffer.alloc(1024 * 1024);
    let total = 0;
    while (true) {
      signal.throwIfAborted();
      const read = await handle.read(buffer, 0, buffer.length, total);
      signal.throwIfAborted();
      if (!read.bytesRead) break;
      total += read.bytesRead;
      if (BigInt(total) > before.size) throw Error('CACHE_APP_CHANGED');
      hash.update(buffer.subarray(0, read.bytesRead));
    }
    if (
      BigInt(total) !== before.size ||
      cacheFileRevision(await step(() => handle.stat({ bigint: true }))) !==
        revision ||
      cacheFileRevision(await step(() => io.lstat(file, { bigint: true }))) !==
        revision
    )
      throw Error('CACHE_APP_CHANGED');
    signal.throwIfAborted();
    return { path: file, revision, scope: hash.digest('hex') };
  } finally {
    await handle.close();
  }
};
export const isCacheApplicationCurrent = async (
  value: CacheApplicationIdentity,
  signal: AbortSignal,
  native: typeof fs = require('original-fs'),
): Promise<boolean> => {
  signal.throwIfAborted();
  const now = await native.promises.lstat(value.path, { bigint: true });
  signal.throwIfAborted();
  const valid =
    now.isFile() &&
    !now.isSymbolicLink() &&
    cacheFileRevision(now) === value.revision &&
    (await native.promises.realpath(value.path)) === value.path;
  signal.throwIfAborted();
  return valid;
};
