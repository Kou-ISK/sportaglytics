import type { BigIntStats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const CACHE_METADATA_BUDGET = 64 * 1024;
export const CACHE_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const entryId = /^(?:ready-|\.pending-)([a-f0-9-]+)$/;
const fileNames = new Set(['media.mp4', 'manifest.json']);

export const cacheDirectoryStamp = (info: BigIntStats): string => {
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('CACHE_UNSAFE_DIRECTORY');
  return `${info.dev}:${info.ino}`;
};

export const assertCacheDirectory = async (
  directory: string,
  stamp: string,
): Promise<void> => {
  if (
    (await fs.realpath(directory)) !== directory ||
    cacheDirectoryStamp(await fs.lstat(directory, { bigint: true })) !== stamp
  )
    throw new Error('CACHE_DIRECTORY_CHANGED');
};

export const cacheDirectoryBytes = async (
  directory: string,
  signal?: AbortSignal,
): Promise<number> => {
  signal?.throwIfAborted();
  const entries = await fs.readdir(directory);
  signal?.throwIfAborted();
  if (entries.some((entry) => !fileNames.has(entry)))
    throw new Error('CACHE_UNEXPECTED_ENTRY');
  let bytes = 0;
  for (const entry of entries) {
    signal?.throwIfAborted();
    const info = await fs.lstat(path.join(directory, entry), { bigint: true });
    signal?.throwIfAborted();
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n)
      throw new Error('CACHE_UNSAFE_FILE');
    bytes += Number(info.size);
    if (!Number.isSafeInteger(bytes)) throw new Error('CACHE_CAPACITY');
  }
  return bytes;
};

/** Interrupted staging is charged to the limit but is never considered ready. */
export const cacheRootBytes = async (
  root: string,
  excludedDirectory?: string,
  signal?: AbortSignal,
): Promise<number> => {
  let bytes = 0;
  let count = 0;
  signal?.throwIfAborted();
  const entries = await fs.opendir(root);
  try {
    while (true) {
      signal?.throwIfAborted();
      const entry = await entries.read();
      signal?.throwIfAborted();
      if (!entry) break;
      if (++count > 1024) throw new Error('CACHE_TOO_MANY_ENTRIES');
      const id = entry.name.match(entryId)?.[1];
      if (!id || !CACHE_ID.test(id)) throw new Error('CACHE_UNEXPECTED_ENTRY');
      const directory = path.join(root, entry.name);
      cacheDirectoryStamp(await fs.lstat(directory, { bigint: true }));
      signal?.throwIfAborted();
      if (directory === excludedDirectory) continue;
      bytes += await cacheDirectoryBytes(directory, signal);
      if (!Number.isSafeInteger(bytes)) throw new Error('CACHE_CAPACITY');
    }
  } finally {
    await entries.close();
  }
  signal?.throwIfAborted();
  return bytes;
};

export const cacheFreeBytes = async (
  root: string,
  signal?: AbortSignal,
): Promise<number> => {
  signal?.throwIfAborted();
  const stats = await fs.statfs(root, { bigint: true });
  signal?.throwIfAborted();
  const free = stats.bavail * stats.bsize;
  return Number(
    free > BigInt(Number.MAX_SAFE_INTEGER)
      ? BigInt(Number.MAX_SAFE_INTEGER)
      : free,
  );
};

export const readCacheManifest = async (file: string): Promise<Buffer> => {
  const before = await fs.lstat(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size > BigInt(CACHE_METADATA_BUDGET)
  )
    throw new Error('CACHE_INVALID_MANIFEST');
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const located = await handle.stat({ bigint: true });
    if (located.dev !== before.dev || located.ino !== before.ino)
      throw new Error('CACHE_INVALID_MANIFEST');
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > CACHE_METADATA_BUDGET)
      throw new Error('CACHE_INVALID_MANIFEST');
    const buffer = Buffer.alloc(CACHE_METADATA_BUDGET + 1);
    let total = 0;
    while (total < buffer.length) {
      const read = await handle.read(
        buffer,
        total,
        buffer.length - total,
        total,
      );
      if (!read.bytesRead) break;
      total += read.bytesRead;
    }
    if (total > CACHE_METADATA_BUDGET)
      throw new Error('CACHE_INVALID_MANIFEST');
    return buffer.subarray(0, total);
  } finally {
    await handle.close();
  }
};
