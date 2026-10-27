import { CacheIdentityHandoff } from './cacheIdentityHandoff';
import { CacheMediaReadAudit } from './cacheMediaReadAudit';
import type { CacheCandidate } from './cacheStorage';
import { app } from 'electron';
import fs from 'node:fs/promises';
import { assertClosedMp4 } from './cacheSourceAccess';
import { identifyCacheTools } from './cacheBundledTools';
import { cacheContentProofs } from './cacheProductionProofs';
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

/** Explicit reuse never creates media or deletes a ready candidate. Complete
 * byte identities and HW are checked again; matching Main-memory content proofs
 * avoid repeating deterministic decode work within the same process/runtime. */
export const reusePlaybackCache = async (
  options: CachePreparationOptions,
): Promise<CachePreparedArtifact> => {
  const { source, signal, assertOwner, notify } = options;
  const started = performance.now();
  const cleanups = new Set<() => Promise<void>>();
  const audit = new CacheMediaReadAudit(source.path);
  const handoff = new CacheIdentityHandoff(signal, audit.observe);
  let candidate: CacheCandidate | null = null;
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
    const context = {
      executable: tools.ffprobe,
      signal,
      stopWaiting,
      observeIdentityRead: audit.observe,
    };
    const sourceProof = await cacheContentProofs.read(
      source.path,
      context,
      tools.runtime,
    );
    const { metadata, timing, identity: sourceIdentity } = sourceProof;
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
      audit.observe,
    );
    job = new PlaybackCacheJob(
      {
        maximumOutputBytes: CACHE_LIMITS.maximumOutputBytes,
        validate: async (workerSignal) => {
          candidate = await storage.findCandidate(
            expectation,
            workerSignal,
            handoff,
          );
          if (!candidate) throw Error('CACHE_CANDIDATE_NOT_FOUND');
          await check();
          validated = await validateCacheMedia({
            hardwareMode: 'compatibility',
            identityHandoff: handoff,
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
          if (!candidate) throw Error('CACHE_CANDIDATE_NOT_FOUND');
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
        discard: async (cleanup) => {
          await handoff.close(cleanup?.retryFailedCleanup === true);
          for (const cleanup of cleanups) await cleanup();
          cleanups.clear();
        },
      },
      notify,
    );
    options.retainJob(job);
    await job.start(expectation, CACHE_LIMITS.maximumOutputBytes);
    if (job.status.error === 'missing')
      throw Error('CACHE_CANDIDATE_NOT_FOUND');
    if (job.status.phase !== 'ready' || !validated || !candidate)
      throw Error('CACHE_REUSE_FAILED');
    await check();
    await sourceProof.remember();
    await check();
    return {
      job,
      expectation,
      candidate,
      audioTracks: metadata.audio.length,
      evidence: {
        mode: 'reused',
        mediaReads: audit.snapshot(),
        elapsedMs: performance.now() - started,
        sourceProof: sourceProof.observation,
        conversion: null,
        validation: validated,
      },
    };
  } finally {
    signal.removeEventListener('abort', abort);
    // A failed close remains latched; only the Job's explicit cleanup retry may retry it.
    await handoff.close();
  }
};
