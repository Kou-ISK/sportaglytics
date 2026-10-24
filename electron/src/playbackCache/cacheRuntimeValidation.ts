import type { CacheAuthorizedSource } from './cacheSourceAccess';
import fs from 'node:fs/promises';
import { assertClosedMp4 } from './cacheSourceAccess';
import type { CacheMediaMetadata } from './cacheMediaMetadata';
import { assertCacheVideoMatches } from './cacheMediaMetadata';
import { cacheContentProofs } from './cacheContentProofs';
import type { CacheProbeContext } from './cacheProbe';
import { identifyCacheSource, readCacheFileIdentity } from './sourceIdentity';
import { probeCacheHardware } from './cacheHardwareProbe';
import type { CacheHardwareMode } from './cacheHardwareCoverage';
import type { CacheHardwareProbeResult } from './cacheHardwareProbe';
import {
  isCacheContentMatching,
  isCacheValidationMatching,
} from './cachePolicy';
import type { CacheExpectation, CacheValidation } from './cachePolicy';

export type CacheRuntimeValidation = CacheValidation & {
  hardware: CacheHardwareProbeResult;
  contentProof: { reused: boolean; elapsedMs: number };
};

/** Creation and explicit reuse share every full-content gate. Only Main-memory
 * content proofs bound to freshly hashed bytes may avoid decode work. Disk
 * manifests never supply proofs. Creation observes full HW playback; reuse
 * freshly observes bounded compatibility ranges, not full-file HW playback. */
export const validateCacheMedia = async (options: {
  hardwareMode: CacheHardwareMode;
  source: CacheAuthorizedSource;
  metadata: CacheMediaMetadata;
  expectation: CacheExpectation;
  candidatePath: string;
  maximumOutputBytes: number;
  privateDirectory: string;
  context: CacheProbeContext;
  check: () => Promise<void>;
  retainCleanup: (cleanup: () => Promise<void>) => void;
}): Promise<CacheRuntimeValidation> => {
  const { source, metadata, expectation, candidatePath, context, check } =
    options;
  await check();
  const info = await fs.lstat(candidatePath);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size > options.maximumOutputBytes
  )
    throw Error('CACHE_UNSAFE_FILE');
  await assertClosedMp4(candidatePath, context.signal);
  const output = await cacheContentProofs.read(
    candidatePath,
    context,
    expectation.runtime,
  );
  assertCacheVideoMatches(metadata, output.metadata);
  const { timing } = output;
  await check();
  const sourceAfter = await identifyCacheSource(source.path, {
    signal: context.signal,
  });
  await check();
  const content = {
    outputBytes: output.identity.bytes,
    outputSha256: output.identity.sha256,
    sourceAfter,
    recipe: expectation.recipe,
    timing,
  };
  if (!isCacheContentMatching(expectation, content))
    throw Error('CACHE_VALIDATION');
  const hardware = await probeCacheHardware(
    candidatePath,
    options.privateDirectory,
    expectation.runtime,
    context.signal,
    context.stopWaiting,
    options.retainCleanup,
    options.hardwareMode,
    expectation.timing.endNumerator / expectation.timing.endDenominator,
  );
  await check();
  const afterHardware = await readCacheFileIdentity(candidatePath, {
    signal: context.signal,
  });
  if (
    afterHardware.revision !== output.revision ||
    afterHardware.identity.sha256 !== output.identity.sha256 ||
    afterHardware.identity.bytes !== output.identity.bytes
  )
    throw Error('CACHE_OUTPUT_CHANGED');
  await check();
  const validation = {
    ...content,
    hardware,
    contentProof: output.observation,
  };
  if (!isCacheValidationMatching(expectation, validation, options.hardwareMode))
    throw Error('CACHE_VALIDATION');
  output.remember();
  return validation;
};
