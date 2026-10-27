import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CACHE_ID,
  cacheDirectoryStamp,
  cacheDirectoryBytes,
  cacheRootBytes,
  cacheFreeBytes,
  readCacheManifest,
} from './cacheStorageIo';
import { readCacheFileIdentity } from './sourceIdentity';
import type { CacheIdentityReadObserver } from './sourceIdentity';
import { isCacheExpectationValid } from './cachePolicy';
import type { CacheExpectation } from './cachePolicy';
import type { CacheCandidate } from './cacheStorage';
import type { CacheIdentityHandoff } from './cacheIdentityHandoff';
interface CandidateAccess {
  findCandidate: (
    expected: CacheExpectation,
    signal: AbortSignal,
    handoff?: CacheIdentityHandoff,
  ) => Promise<CacheCandidate | null>;
  inspectCandidate: (
    id: string,
    expected: CacheExpectation,
    signal?: AbortSignal,
  ) => Promise<CacheCandidate | null>;
}
export const createCacheCandidateAccess = (options: {
  root: string;
  assertRoot: () => Promise<void>;
  maximumCacheBytes: number;
  maximumOutputBytes: number;
  reserveBytes: number;
  keyFor: (expected: CacheExpectation) => string;
  observe?: CacheIdentityReadObserver;
}): CandidateAccess => {
  const {
    root,
    assertRoot,
    maximumCacheBytes,
    maximumOutputBytes,
    reserveBytes,
    keyFor,
  } = options;
  const validLimit = (value: number): boolean =>
    Number.isSafeInteger(value) && value > 0;
  const inspect = async (
    id: string,
    expected: CacheExpectation,
    signal?: AbortSignal,
    handoff?: CacheIdentityHandoff,
  ): Promise<CacheCandidate | null> => {
    if (!CACHE_ID.test(id) || !isCacheExpectationValid(expected))
      throw new Error('CACHE_INVALID_CANDIDATE');
    const expectedKey = keyFor(structuredClone(expected));
    await assertRoot();
    const directory = path.join(root, `ready-${id}`);
    let captureStarted = false;
    try {
      cacheDirectoryStamp(await fs.lstat(directory, { bigint: true }));
      const data: unknown = JSON.parse(
        (
          await readCacheManifest(path.join(directory, 'manifest.json'))
        ).toString('utf8'),
      );
      if (
        !data ||
        typeof data !== 'object' ||
        !('schemaVersion' in data) ||
        data.schemaVersion !== 1 ||
        !('artifactId' in data) ||
        data.artifactId !== id ||
        !('expectationKey' in data) ||
        data.expectationKey !== expectedKey
      )
        return null;
      if (
        !('sha256' in data) ||
        typeof data.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(data.sha256) ||
        !('bytes' in data) ||
        typeof data.bytes !== 'number' ||
        !validLimit(data.bytes) ||
        data.bytes > maximumOutputBytes
      )
        throw new Error('CACHE_INVALID_MANIFEST');
      await cacheDirectoryBytes(directory);
      const mediaPath = path.join(directory, 'media.mp4');
      const info = await fs.lstat(mediaPath);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.nlink !== 1 ||
        info.size > maximumOutputBytes
      )
        throw Error('CACHE_UNSAFE_FILE');
      if (handoff && !signal) throw Error('CACHE_HANDOFF_SIGNAL_REQUIRED');
      captureStarted = Boolean(handoff);
      const output =
        handoff && signal
          ? await handoff.capture(mediaPath, signal)
          : await readCacheFileIdentity(mediaPath, {
              signal,
              observe: options.observe,
            });
      if (
        output.identity.sha256 !== data.sha256 ||
        output.identity.bytes !== data.bytes
      )
        throw new Error('CACHE_OUTPUT_CHANGED');
      return { artifactId: id, mediaPath, ...output.identity };
    } catch (error) {
      if (
        !captureStarted &&
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
  };
  return {
    async findCandidate(expected, signal, handoff) {
      signal.throwIfAborted();
      if (!isCacheExpectationValid(expected))
        throw Error('CACHE_INVALID_EXPECTATION');
      await assertRoot();
      if (
        (await cacheRootBytes(root, undefined, signal)) > maximumCacheBytes ||
        (await cacheFreeBytes(root, signal)) < reserveBytes
      )
        throw Error('CACHE_CAPACITY');
      const entries = await fs.opendir(root);
      let count = 0;
      for await (const entry of entries) {
        signal.throwIfAborted();
        if (++count > 1024) throw Error('CACHE_TOO_MANY_ENTRIES');
        if (!entry.name.startsWith('ready-')) continue;
        const candidate = await inspect(
          entry.name.slice(6),
          expected,
          signal,
          handoff,
        );
        if (candidate) return candidate;
      }
      signal.throwIfAborted();
      return null;
    },
    inspectCandidate: (id, expected, signal) => inspect(id, expected, signal),
  };
};
