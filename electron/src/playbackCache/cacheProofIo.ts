import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { cacheFileRevision } from './sourceIdentity';
import { CACHE_PROOF_BYTES } from './cacheProofRecord';

const missing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';
const owned = (info: BigIntStats): boolean =>
  typeof process.getuid === 'function' &&
  info.uid === BigInt(process.getuid()) &&
  (info.mode & 0o077n) === 0n;
const regular = (info: BigIntStats, max: number): boolean =>
  owned(info) &&
  info.isFile() &&
  !info.isSymbolicLink() &&
  info.nlink === 1n &&
  info.size <= BigInt(max);
export interface CacheProofDirectory {
  root: string;
  check: (signal?: AbortSignal) => Promise<void>;
}
export const openCacheProofDirectory = async (
  parent: string,
  signal?: AbortSignal,
): Promise<CacheProofDirectory> => {
  const step = async <T>(work: () => Promise<T>): Promise<T> => {
    signal?.throwIfAborted();
    const value = await work();
    signal?.throwIfAborted();
    return value;
  };
  const real = await step(() => fs.realpath(parent)),
    info = await step(() => fs.lstat(real, { bigint: true }));
  if (
    !info.isDirectory() ||
    typeof process.getuid !== 'function' ||
    info.uid !== BigInt(process.getuid()) ||
    (info.mode & 0o022n) !== 0n
  )
    throw Error('CACHE_PROOF_PARENT');
  const root = path.join(real, 'playback-content-proofs-v1');
  await step(() =>
    fs.mkdir(root, { mode: 0o700 }).catch((e: unknown) => {
      if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) throw e;
    }),
  );
  const stamp = await step(() => fs.lstat(root, { bigint: true }));
  const check = async (current?: AbortSignal): Promise<void> => {
    current?.throwIfAborted();
    const now = await fs.lstat(root, { bigint: true });
    current?.throwIfAborted();
    if (
      !owned(now) ||
      !now.isDirectory() ||
      now.isSymbolicLink() ||
      now.dev !== stamp.dev ||
      now.ino !== stamp.ino
    )
      throw Error('CACHE_PROOF_DIRECTORY');
    if ((await fs.realpath(root)) !== root)
      throw Error('CACHE_PROOF_DIRECTORY');
    current?.throwIfAborted();
  };
  await check(signal);
  signal?.throwIfAborted();
  const entries = await fs.opendir(root);
  let count = 0,
    bytes = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const entry = await entries.read();
      signal?.throwIfAborted();
      if (!entry) break;
      if (
        ++count > 10 ||
        (!['key', 'ledger.json'].includes(entry.name) &&
          !/^\.pending-[a-f0-9-]{36}$/.test(entry.name))
      )
        throw Error('CACHE_PROOF_ENTRIES');
      const item = await step(() =>
        fs.lstat(path.join(root, entry.name), { bigint: true }),
      );
      if (!regular(item, CACHE_PROOF_BYTES)) throw Error('CACHE_PROOF_FILE');
      bytes += Number(item.size);
      if (bytes > CACHE_PROOF_BYTES * 3) throw Error('CACHE_PROOF_BUDGET');
    }
  } finally {
    await entries.close();
  }
  return { root, check };
};
export const readCacheProofFile = async (
  directory: CacheProofDirectory,
  name: 'key' | 'ledger.json',
  maximum: number,
  signal: AbortSignal,
): Promise<Buffer | null> => {
  const step = async <T>(work: () => Promise<T>): Promise<T> => {
    signal.throwIfAborted();
    const value = await work();
    signal.throwIfAborted();
    return value;
  };
  signal.throwIfAborted();
  await directory.check(signal);
  const target = path.join(directory.root, name);
  let before: BigIntStats;
  try {
    before = await step(() => fs.lstat(target, { bigint: true }));
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
  signal.throwIfAborted();
  if (!regular(before, maximum)) throw Error('CACHE_PROOF_FILE');
  const handle = await fs.open(
    target,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    signal.throwIfAborted();
    if (
      cacheFileRevision(await step(() => handle.stat({ bigint: true }))) !==
      cacheFileRevision(before)
    )
      throw Error('CACHE_PROOF_CHANGED');
    const data = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < data.length) {
      signal.throwIfAborted();
      const part = await handle.read(data, total, data.length - total, total);
      if (!part.bytesRead) break;
      total += part.bytesRead;
    }
    signal.throwIfAborted();
    const after = await step(() => handle.stat({ bigint: true })),
      located = await step(() => fs.lstat(target, { bigint: true }));
    if (
      total > maximum ||
      !regular(after, maximum) ||
      !regular(located, maximum) ||
      cacheFileRevision(before) !== cacheFileRevision(after) ||
      cacheFileRevision(before) !== cacheFileRevision(located)
    )
      throw Error('CACHE_PROOF_CHANGED');
    await directory.check(signal);
    signal.throwIfAborted();
    return data.subarray(0, total);
  } finally {
    await handle.close();
  }
};
export const readOrCreateCacheProofKey = async (
  directory: CacheProofDirectory,
  signal: AbortSignal,
): Promise<Buffer> => {
  const prior = await readCacheProofFile(directory, 'key', 32, signal);
  if (prior) {
    if (prior.length !== 32) throw Error('CACHE_PROOF_KEY');
    return prior;
  }
  // A missing key never authenticates old entries; their MAC will not match.
  signal.throwIfAborted();
  await directory.check(signal);
  const key = randomBytes(32),
    handle = await fs.open(path.join(directory.root, 'key'), 'wx', 0o600);
  try {
    signal.throwIfAborted();
    await handle.writeFile(key);
    signal.throwIfAborted();
    await handle.sync();
  } finally {
    await handle.close();
  }
  await directory.check(signal);
  signal.throwIfAborted();
  return key;
};
export type CacheProofWrite = 'stored' | 'not-stored' | 'uncertain';
export const writeCacheProofFile = async (
  directory: CacheProofDirectory,
  data: Buffer,
  signal: AbortSignal,
  record: (result: CacheProofWrite) => void = () => undefined,
): Promise<CacheProofWrite> => {
  if (data.length > CACHE_PROOF_BYTES) throw Error('CACHE_PROOF_BUDGET');
  signal.throwIfAborted();
  await directory.check(signal);
  // Existing ledger must remain a regular owned file. No foreign path traversal.
  await readCacheProofFile(directory, 'ledger.json', CACHE_PROOF_BYTES, signal);
  const temp = path.join(directory.root, '.pending-' + randomUUID());
  const file = await fs.open(temp, 'wx', 0o600);
  let stamp: BigIntStats | undefined;
  let dispatched = false;
  const observe = (result: CacheProofWrite): void => {
    try {
      record(result);
    } catch {
      /* Advisory only. */
    }
  };
  try {
    stamp = await file.stat({ bigint: true });
    signal.throwIfAborted();
    await file.writeFile(data);
    signal.throwIfAborted();
    await file.sync();
    await file.close();
    await directory.check(signal);
    const located = await fs.lstat(temp, { bigint: true });
    if (
      !regular(located, CACHE_PROOF_BYTES) ||
      located.dev !== stamp.dev ||
      located.ino !== stamp.ino ||
      located.size !== BigInt(data.length)
    )
      throw Error('CACHE_PROOF_CHANGED');
    signal.throwIfAborted();
    dispatched = true;
    observe('uncertain');
    await fs.rename(temp, path.join(directory.root, 'ledger.json'));
    const parent = await fs.open(directory.root, fs.constants.O_RDONLY);
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
    await directory.check();
    observe('stored');
    signal.throwIfAborted();
    return 'stored';
  } catch (error) {
    signal.throwIfAborted();
    if (dispatched) return 'uncertain';
    throw error;
  } finally {
    await file.close();
    // After rename dispatch, do not retry or claim an uncertain write is absent.
    if (!dispatched) {
      try {
        await directory.check();
        const now = await fs.lstat(temp, { bigint: true });
        if (
          stamp &&
          now.dev === stamp.dev &&
          now.ino === stamp.ino &&
          regular(now, CACHE_PROOF_BYTES)
        )
          await fs.unlink(temp);
      } catch {
        /* Uncommitted known temp is never read; next open charges its bounded size. */
      }
    }
  }
};
