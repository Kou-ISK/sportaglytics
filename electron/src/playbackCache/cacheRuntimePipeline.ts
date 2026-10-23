import { app } from 'electron';
import path from 'node:path';
import type { PlaybackCacheStatus } from '../../../src/types/playbackCache';
import type { CacheAuthorizedSource } from './cacheSourceAccess';
import { assertClosedMp4 } from './cacheSourceAccess';
import { identifyCacheTools } from './cacheBundledTools';
import { identifyCacheSource, readCacheFileIdentity } from './sourceIdentity';
import { probeCacheMetadata, probeCacheTiming } from './cacheProbe';
import {
  buildCacheRecipe,
  CACHE_RECIPE,
  cacheVideoBitrate,
} from './cacheRecipe';
import { assertCacheVideoMatches } from './cacheMediaMetadata';
import { openPlaybackCacheStorage } from './cacheStorage';
import type { CacheCandidate, CacheStaging } from './cacheStorage';
import { PlaybackCacheJob } from './cacheJob';
import { runCacheConversion } from './cacheConversionRunner';
import { spawnCacheWorker } from './cacheWorkerProcess';
import { probeCacheHardware } from './cacheHardwareProbe';
import { isCacheValidationMatching } from './cachePolicy';
import type { CacheExpectation, CacheValidation } from './cachePolicy';

export const CACHE_LIMITS = {
  maximumCacheBytes: 8 * 1024 ** 3,
  maximumOutputBytes: 1024 ** 3,
  reserveBytes: 2 * 1024 ** 3,
};
export interface CachePreparedArtifact {
  job: PlaybackCacheJob;
  expectation: CacheExpectation;
  candidate: CacheCandidate;
  audioTracks: number;
}
/** Main owns this entire promise, including preflight/probes, through shutdown.
 * signal cancellation never permits cleanup before owned work has closed. */
export const preparePlaybackCache = async (options: {
  source: CacheAuthorizedSource;
  signal: AbortSignal;
  assertOwner: () => Promise<void>;
  notify: (state: PlaybackCacheStatus) => void;
  retainJob: (job: PlaybackCacheJob) => void;
}): Promise<CachePreparedArtifact> => {
  const { source, signal, assertOwner, notify } = options;
  let staging: CacheStaging | undefined;
  const probeCleanups = new Set<() => Promise<void>>();
  let job: PlaybackCacheJob | undefined;
  let jobOwnsCleanup = false;
  let publishedId: string | null = null;
  const check = async (): Promise<void> => {
    signal.throwIfAborted();
    await assertOwner();
    await source.assertCurrent();
    signal.throwIfAborted();
  };
  const stopWaiting = (unconfirmed: boolean): void =>
    notify({
      phase: 'cancelling',
      selected: 'original',
      progress: null,
      error: unconfirmed ? 'stop' : null,
    });
  const abort = (): void => {
    job?.cancel();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await check();
    await assertClosedMp4(source.path, signal);
    const tools = await identifyCacheTools(signal);
    await check();
    const context = { executable: tools.ffprobe, signal, stopWaiting };
    const metadata = await probeCacheMetadata(source.path, context);
    await check();
    const sourceIdentity = await identifyCacheSource(source.path, { signal });
    const timing = await probeCacheTiming(source.path, metadata, context);
    await check();
    const expectation: CacheExpectation = {
      source: sourceIdentity,
      recipe: CACHE_RECIPE,
      runtime: tools.runtime,
      timing,
    };
    const storage = await openPlaybackCacheStorage(
      app.getPath('userData'),
      CACHE_LIMITS,
    );
    staging = await storage.begin(expectation, CACHE_LIMITS.maximumOutputBytes);
    const owned = staging;
    const estimatedBytes = Math.ceil(
      source.bytes +
        (cacheVideoBitrate(metadata) / 8) * metadata.durationSeconds * 1.5,
    );
    job = new PlaybackCacheJob(
      {
        capacity: owned.capacity,
        convert: async (workerSignal, progress, _budget, onStop) => {
          await check();
          await runCacheConversion(
            (events) =>
              spawnCacheWorker(
                tools.ffmpeg,
                buildCacheRecipe(source.path, owned.outputPath, metadata),
                events,
              ),
            {
              signal: workerSignal,
              durationSeconds: metadata.durationSeconds,
              timeoutMs: 1800000,
              budgetPollMs: 1000,
              budgetDeadlineMs: 5000,
              stopWarningMs: 3000,
              maximumDiagnosticBytes: 1024 * 1024,
              checkBudget: async () => {
                await check();
                await owned.checkBudget();
              },
              progress,
              stopWaiting: onStop,
            },
          );
        },
        validate: async (workerSignal) => {
          await check();
          const probe = { ...context, signal: workerSignal };
          const outputMetadata = await probeCacheMetadata(
            owned.outputPath,
            probe,
          );
          assertCacheVideoMatches(metadata, outputMetadata);
          const outputTiming = await probeCacheTiming(
            owned.outputPath,
            outputMetadata,
            probe,
          );
          await check();
          const output = await readCacheFileIdentity(owned.outputPath, {
            signal: workerSignal,
          });
          const sourceAfter = await identifyCacheSource(source.path, {
            signal: workerSignal,
          });
          await check();
          const hardware = await probeCacheHardware(
            owned.outputPath,
            path.dirname(owned.outputPath),
            tools.runtime,
            workerSignal,
            stopWaiting,
            (cleanup) => {
              probeCleanups.add(cleanup);
            },
          );
          await check();
          const validation: CacheValidation = {
            outputBytes: output.identity.bytes,
            outputSha256: output.identity.sha256,
            sourceAfter,
            recipe: CACHE_RECIPE,
            timing: outputTiming,
            hardware,
          };
          if (!isCacheValidationMatching(expectation, validation))
            throw Error('CACHE_VALIDATION');
          await owned.seal(validation, workerSignal);
          return validation;
        },
        publish: async () => {
          await check();
          publishedId = await owned.publish();
          return publishedId;
        },
        discard: async () => {
          for (const cleanup of probeCleanups) await cleanup();
          probeCleanups.clear();
          await owned.discard();
        },
      },
      notify,
    );
    options.retainJob(job);
    // Close cancellation can happen while resolving storage, before job exists.
    jobOwnsCleanup = true;
    await job.start(expectation, estimatedBytes);
    if (job.status.phase !== 'ready') throw Error('CACHE_PREPARATION_FAILED');
    await assertOwner();
    if (!publishedId) throw Error('CACHE_CANDIDATE_MISSING');
    const candidate = await storage.inspectCandidate(
      publishedId,
      expectation,
      signal,
    );
    if (!candidate) throw Error('CACHE_CANDIDATE_MISSING');
    await check();
    return { job, expectation, candidate, audioTracks: metadata.audio.length };
  } catch (error) {
    if (staging && !jobOwnsCleanup) await staging.discard();
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
};
