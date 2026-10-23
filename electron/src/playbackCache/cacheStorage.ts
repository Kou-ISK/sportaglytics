import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CACHE_ID,
  CACHE_METADATA_BUDGET,
  assertCacheDirectory,
  cacheDirectoryBytes,
  cacheDirectoryStamp,
  cacheFreeBytes,
  cacheRootBytes,
  readCacheManifest,
} from './cacheStorageIo';
import { cacheFileRevision, readCacheFileIdentity } from './sourceIdentity';
import {
  isCacheExpectationValid,
  isCacheValidationMatching,
} from './cachePolicy';
import type { CacheExpectation, CacheValidation } from './cachePolicy';
import type { CacheJobPorts } from './cacheJob';

const activeRoots = new Set<string>();
const hash = (bytes: string | Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const keyFor = (expected: CacheExpectation): string =>
  hash(
    JSON.stringify({
      source: expected.source,
      recipe: expected.recipe,
      runtime: expected.runtime,
      timing: expected.timing,
    }),
  );
const validLimit = (value: number, allowZero = false): boolean =>
  Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1);

export interface CacheStaging {
  readonly outputPath: string;
  capacity: CacheJobPorts['capacity'];
  /** The owned runner must poll this while writing and stop on rejection. */
  checkBudget: () => Promise<void>;
  /** Call within the cancellable validation phase, after the worker has stopped. */
  seal: (validation: CacheValidation, signal?: AbortSignal) => Promise<void>;
  publish: CacheJobPorts['publish'];
  discard: CacheJobPorts['discard'];
}

/** A candidate is not proof of timing, audio or HW suitability. The Main validator
 * must revalidate it before a playback selector can expose it to Renderer. */
export interface CacheCandidate {
  artifactId: string;
  mediaPath: string;
  sha256: string;
  bytes: number;
}

export interface PlaybackCacheStorage {
  begin: (
    expected: CacheExpectation,
    maximumOutputBytes: number,
  ) => Promise<CacheStaging>;
  inspectCandidate: (
    id: string,
    expected: CacheExpectation,
    signal?: AbortSignal,
  ) => Promise<CacheCandidate | null>;
}

/** Main-only filesystem adapter. The parent must be the application's private
 * data directory, never a package/Renderer-selected path. Main's single-instance
 * lifecycle owns this namespace; separate Main instances must use separate roots.
 * Only one writer per root is admitted in this process, across windows/adapters. */
export const openPlaybackCacheStorage = async (
  trustedAppDataDirectory: string,
  limits: { maximumCacheBytes: number; reserveBytes: number },
): Promise<PlaybackCacheStorage> => {
  if (
    !validLimit(limits.maximumCacheBytes) ||
    !validLimit(limits.reserveBytes, true) ||
    !Number.isSafeInteger(limits.reserveBytes + CACHE_METADATA_BUDGET)
  )
    throw new Error('CACHE_INVALID_LIMIT');
  const maximumCacheBytes = limits.maximumCacheBytes;
  const reserveBytes = limits.reserveBytes + CACHE_METADATA_BUDGET;
  const parent = await fs.realpath(trustedAppDataDirectory);
  const root = path.join(parent, 'playback-cache-v1');
  await fs.mkdir(root, { mode: 0o700 }).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  });
  const rootStamp = cacheDirectoryStamp(await fs.lstat(root, { bigint: true }));
  const assertRoot = (): Promise<void> => assertCacheDirectory(root, rootStamp);
  await assertRoot();

  return {
    async begin(expected, maximumOutputBytes) {
      if (!isCacheExpectationValid(expected) || !validLimit(maximumOutputBytes))
        throw new Error('CACHE_INVALID_EXPECTATION');
      const expectation = structuredClone(expected);
      if (activeRoots.has(root)) throw new Error('CACHE_BUSY');
      activeRoots.add(root);
      const id = randomUUID();
      const staging = path.join(root, `.pending-${id}`);
      const ready = path.join(root, `ready-${id}`);
      const outputPath = path.join(staging, 'media.mp4');
      const manifestPath = path.join(staging, 'manifest.json');
      try {
        await assertRoot();
        const used = await cacheRootBytes(root);
        const maxBytes = Math.min(
          maximumOutputBytes,
          maximumCacheBytes - used - CACHE_METADATA_BUDGET,
        );
        if (maxBytes <= 0 || (await cacheFreeBytes(root)) <= reserveBytes)
          throw new Error('CACHE_CAPACITY');
        await fs.mkdir(staging, { mode: 0o700 });
        const stamp = cacheDirectoryStamp(
          await fs.lstat(staging, { bigint: true }),
        );
        let phase:
          | 'writing'
          | 'sealing'
          | 'sealed'
          | 'publishing'
          | 'published'
          | 'failed'
          | 'discarding'
          | 'discarded' = 'writing';
        let sealed: {
          revision: string;
          manifestSha256: string;
          outputBytes: number;
        } | null = null;
        const assertOwned = async (): Promise<void> => {
          await assertRoot();
          await assertCacheDirectory(staging, stamp);
        };
        const capacity = async (): ReturnType<CacheJobPorts['capacity']> => {
          await assertOwned();
          const remaining =
            maximumCacheBytes -
            (await cacheRootBytes(root, staging)) -
            CACHE_METADATA_BUDGET;
          return {
            freeBytes: await cacheFreeBytes(root),
            reserveBytes,
            maxBytes: Math.min(maxBytes, remaining),
          };
        };
        const checkBudget = async (): Promise<void> => {
          const budget = await capacity();
          await cacheDirectoryBytes(staging);
          const output = await fs.lstat(outputPath).catch((error: unknown) => {
            if (
              error instanceof Error &&
              'code' in error &&
              error.code === 'ENOENT'
            )
              return null;
            throw error;
          });
          if (
            budget.maxBytes <= 0 ||
            budget.freeBytes < budget.reserveBytes ||
            (output && output.size > budget.maxBytes)
          )
            throw new Error('CACHE_CAPACITY');
        };
        return {
          outputPath,
          capacity,
          checkBudget,
          async seal(validation, signal) {
            if (phase !== 'writing') throw new Error('CACHE_BUSY');
            phase = 'sealing';
            try {
              signal?.throwIfAborted();
              if (!isCacheValidationMatching(expectation, validation))
                throw new Error('CACHE_VALIDATION');
              const proof = structuredClone(validation);
              await assertOwned();
              const budget = await capacity();
              if (
                proof.outputBytes > budget.maxBytes ||
                budget.freeBytes < budget.reserveBytes
              )
                throw new Error('CACHE_CAPACITY');
              if ((await fs.lstat(outputPath)).nlink !== 1)
                throw new Error('CACHE_UNSAFE_FILE');
              const output = await readCacheFileIdentity(outputPath, {
                signal,
              });
              if (
                output.identity.bytes !== proof.outputBytes ||
                output.identity.sha256 !== proof.outputSha256
              )
                throw new Error('CACHE_OUTPUT_CHANGED');
              signal?.throwIfAborted();
              const manifest = JSON.stringify({
                schemaVersion: 1,
                artifactId: id,
                expectationKey: keyFor(expectation),
                sha256: output.identity.sha256,
                bytes: output.identity.bytes,
              });
              const media = await fs.open(
                outputPath,
                fs.constants.O_RDWR | fs.constants.O_NOFOLLOW,
              );
              try {
                await media.sync();
              } finally {
                await media.close();
              }
              signal?.throwIfAborted();
              const file = await fs.open(manifestPath, 'wx', 0o600);
              try {
                await file.writeFile(manifest);
                await file.sync();
              } finally {
                await file.close();
              }
              signal?.throwIfAborted();
              sealed = {
                revision: output.revision,
                manifestSha256: hash(manifest),
                outputBytes: output.identity.bytes,
              };
              phase = 'sealed';
            } catch (error) {
              phase = 'failed';
              throw error;
            }
          },
          async publish() {
            if (phase !== 'sealed' || !sealed)
              throw new Error('CACHE_NOT_SEALED');
            phase = 'publishing';
            try {
              await assertOwned();
              const budget = await capacity();
              if (
                sealed.outputBytes > budget.maxBytes ||
                budget.freeBytes < budget.reserveBytes
              )
                throw new Error('CACHE_CAPACITY');
              const info = await fs.lstat(outputPath, { bigint: true });
              if (
                !info.isFile() ||
                info.nlink !== 1n ||
                cacheFileRevision(info) !== sealed.revision ||
                hash(await readCacheManifest(manifestPath)) !==
                  sealed.manifestSha256
              )
                throw new Error('CACHE_OUTPUT_CHANGED');
              await cacheDirectoryBytes(staging);
              // Same-root rename exposes media + manifest together. No later
              // fallible I/O is allowed to turn a committed artifact into failure.
              const destination = await fs
                .lstat(ready)
                .catch((error: unknown) => {
                  if (
                    error instanceof Error &&
                    'code' in error &&
                    error.code === 'ENOENT'
                  )
                    return null;
                  throw error;
                });
              if (destination) throw new Error('CACHE_DESTINATION_EXISTS');
              await fs.rename(staging, ready);
              phase = 'published';
              activeRoots.delete(root);
              return id;
            } catch (error) {
              phase = 'failed';
              throw error;
            }
          },
          async discard() {
            if (phase === 'published' || phase === 'discarded') return;
            if (['sealing', 'publishing', 'discarding'].includes(phase))
              throw new Error('CACHE_BUSY');
            phase = 'discarding';
            try {
              await assertOwned();
              const entries = await fs.readdir(staging);
              if (
                entries.some(
                  (entry) => !['media.mp4', 'manifest.json'].includes(entry),
                )
              )
                throw new Error('CACHE_UNEXPECTED_ENTRY');
              // Unlink fixed names only; never recursively traverse an injected
              // directory/symlink, or remove a previous ready artifact.
              for (const entry of entries)
                await fs.unlink(path.join(staging, entry));
              await fs.rmdir(staging);
              phase = 'discarded';
              activeRoots.delete(root);
            } catch (error) {
              phase = 'failed';
              throw error;
            }
          },
        };
      } catch (error) {
        activeRoots.delete(root);
        throw error;
      }
    },
    async inspectCandidate(id, expected, signal) {
      if (!CACHE_ID.test(id) || !isCacheExpectationValid(expected))
        throw new Error('CACHE_INVALID_CANDIDATE');
      const expectedKey = keyFor(structuredClone(expected));
      await assertRoot();
      const directory = path.join(root, `ready-${id}`);
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
          !validLimit(data.bytes)
        )
          throw new Error('CACHE_INVALID_MANIFEST');
        await cacheDirectoryBytes(directory);
        const mediaPath = path.join(directory, 'media.mp4');
        const output = await readCacheFileIdentity(mediaPath, { signal });
        if (
          output.identity.sha256 !== data.sha256 ||
          output.identity.bytes !== data.bytes
        )
          throw new Error('CACHE_OUTPUT_CHANGED');
        return { artifactId: id, mediaPath, ...output.identity };
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return null;
        throw error;
      }
    },
  };
};
