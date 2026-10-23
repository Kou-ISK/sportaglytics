import { app } from 'electron';
import fs from 'node:fs/promises';
import { assertClosedMp4 } from './cacheSourceAccess';
import { identifyCacheTools } from './cacheBundledTools';
import { identifyCacheSource } from './sourceIdentity';
import { probeCacheMetadata, probeCacheTiming } from './cacheProbe';
import { CACHE_RECIPE } from './cacheRecipe';
import { openPlaybackCacheStorage } from './cacheStorage';
import { PlaybackCacheJob } from './cacheJob';
import { validateCacheMedia } from './cacheRuntimeValidation';
import type { CacheRuntimeValidation } from './cacheRuntimeValidation';
import { CACHE_LIMITS } from './cacheRuntimePipeline';
import type {
  CachePreparedArtifact,
  CachePreparationOptions,
} from './cacheRuntimePipeline';

/** Explicit reuse never creates media or deletes a ready candidate. Every gate
 * runs again against real input/output bytes in the current runtime. */
export const reusePlaybackCache = async (
  options: CachePreparationOptions,
): Promise<CachePreparedArtifact> => {
  const { source, signal, assertOwner, notify } = options;
  const started = performance.now();
  const cleanups = new Set<() => Promise<void>>();
  let job: PlaybackCacheJob | undefined;
  let validated: CacheRuntimeValidation | undefined;
  const check = async (): Promise<void> => {
    signal.throwIfAborted();
    await assertOwner();
    await source.assertCurrent();
    signal.throwIfAborted();
  };
  const abort = (): void => {
    job?.cancel();
  };
  signal.addEventListener('abort', abort, { once: true });
  const stopWaiting = (unconfirmed: boolean): void =>
    notify({
      phase: 'cancelling',
      progress: null,
      selected: 'original',
      error: unconfirmed ? 'stop' : null,
    });
  try {
    await check();
    await assertClosedMp4(source.path, signal);
    const tools = await identifyCacheTools(signal);
    const context = { executable: tools.ffprobe, signal, stopWaiting };
    const metadata = await probeCacheMetadata(source.path, context);
    await check();
    const sourceIdentity = await identifyCacheSource(source.path, { signal });
    const timing = await probeCacheTiming(source.path, metadata, context);
    await check();
    const expectation = {
      source: sourceIdentity,
      recipe: CACHE_RECIPE,
      runtime: tools.runtime,
      timing,
    };
    const privateDirectory = await fs.realpath(app.getPath('userData'));
    const storage = await openPlaybackCacheStorage(
      privateDirectory,
      CACHE_LIMITS,
    );
    const candidate = await storage.findCandidate(expectation, signal);
    if (!candidate) throw Error('CACHE_CANDIDATE_NOT_FOUND');
    await check();
    job = new PlaybackCacheJob(
      {
        maximumOutputBytes: CACHE_LIMITS.maximumOutputBytes,
        validate: async (workerSignal) => {
          validated = await validateCacheMedia({
            source,
            metadata,
            expectation,
            candidatePath: candidate.mediaPath,
            maximumOutputBytes: CACHE_LIMITS.maximumOutputBytes,
            // Scratch is outside ready/ and never changes its immutable contents.
            privateDirectory,
            context: { ...context, signal: workerSignal },
            check,
            retainCleanup: (cleanup) => {
              cleanups.add(cleanup);
            },
          });
          if (
            validated.outputBytes !== candidate.bytes ||
            validated.outputSha256 !== candidate.sha256
          )
            throw Error('CACHE_OUTPUT_CHANGED');
          return validated;
        },
        reuse: async (workerSignal) => {
          const current = await storage.inspectCandidate(
            candidate.artifactId,
            expectation,
            workerSignal,
          );
          await check();
          if (
            !current ||
            current.bytes !== candidate.bytes ||
            current.sha256 !== candidate.sha256
          )
            throw Error('CACHE_OUTPUT_CHANGED');
          return candidate.artifactId;
        },
        discard: async () => {
          for (const cleanup of cleanups) await cleanup();
          cleanups.clear();
        },
      },
      notify,
    );
    options.retainJob(job);
    await job.start(expectation, candidate.bytes);
    if (job.status.phase !== 'ready' || !validated)
      throw Error('CACHE_REUSE_FAILED');
    await check();
    return {
      job,
      expectation,
      candidate,
      audioTracks: metadata.audio.length,
      evidence: {
        mode: 'reused',
        elapsedMs: performance.now() - started,
        conversion: null,
        validation: validated,
      },
    };
  } finally {
    signal.removeEventListener('abort', abort);
  }
};
