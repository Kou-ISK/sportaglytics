import { isCacheHardwareCoverageValid } from './cacheHardwareCoverage';
import type {
  CacheHardwareCoverage,
  CacheHardwareMode,
} from './cacheHardwareCoverage';
import type { PlaybackCacheEstimate } from '../../../src/types/playbackCache';

export interface CacheSourceIdentity {
  sha256: string;
  bytes: number;
}

/** Digests cover the complete ordered sequence in canonical rational seconds.
 * displayIntervals includes every source field and its duration/end when the recipe emits field-rate video.
 * Audio payloads are copied, not re-encoded. The trusted validator computes these;
 * a manifest or a renderer-provided boolean is never evidence of equivalence. */
export interface CacheTimingProof {
  fpsNumerator: number;
  fpsDenominator: number;
  displayFrames: number;
  endNumerator: number;
  endDenominator: number;
  displayIntervalsSha256: string;
  audio: readonly {
    streamIndex: number;
    codec: string;
    packets: number;
    timesSha256: string;
    payloadSha256: string;
    configurationSha256: string;
  }[];
}

export interface CacheExpectation {
  source: CacheSourceIdentity;
  recipe: string;
  runtime: string;
  timing: CacheTimingProof;
}

export interface CacheValidation {
  outputBytes: number;
  /** Full output digest computed by the trusted validator, not its manifest. */
  outputSha256: string;
  sourceAfter: CacheSourceIdentity;
  recipe: string;
  timing: CacheTimingProof;
  hardware: {
    runtime: string;
    coverage: CacheHardwareCoverage;
    platformDecoder: boolean;
    softwareFallback: boolean;
  };
}

const positive = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
const digest = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const validTiming = (timing: CacheTimingProof): boolean =>
  positive(timing.fpsNumerator) &&
  positive(timing.fpsDenominator) &&
  positive(timing.displayFrames) &&
  positive(timing.endNumerator) &&
  positive(timing.endDenominator) &&
  digest(timing.displayIntervalsSha256) &&
  new Set(timing.audio.map((track) => track.streamIndex)).size ===
    timing.audio.length &&
  timing.audio.every(
    (track) =>
      Number.isSafeInteger(track.streamIndex) &&
      track.streamIndex >= 0 &&
      track.codec.length > 0 &&
      positive(track.packets) &&
      digest(track.timesSha256) &&
      digest(track.payloadSha256) &&
      digest(track.configurationSha256),
  );

export const isCacheExpectationValid = (expected: CacheExpectation): boolean =>
  digest(expected.source.sha256) &&
  positive(expected.source.bytes) &&
  expected.recipe.length > 0 &&
  expected.runtime.length > 0 &&
  validTiming(expected.timing);

/** Content checks must pass before probing the current HW decoder. This
 * result alone never authorizes publication, reuse or playback selection. */
export const isCacheContentMatching = (
  expected: CacheExpectation,
  actual: Omit<CacheValidation, 'hardware'>,
): boolean =>
  positive(actual.outputBytes) &&
  digest(actual.outputSha256) &&
  isCacheExpectationValid(expected) &&
  expected.source.sha256 === actual.sourceAfter.sha256 &&
  expected.source.bytes === actual.sourceAfter.bytes &&
  expected.recipe === actual.recipe &&
  validTiming(expected.timing) &&
  validTiming(actual.timing) &&
  expected.timing.fpsNumerator === actual.timing.fpsNumerator &&
  expected.timing.fpsDenominator === actual.timing.fpsDenominator &&
  expected.timing.displayFrames === actual.timing.displayFrames &&
  expected.timing.endNumerator === actual.timing.endNumerator &&
  expected.timing.endDenominator === actual.timing.endDenominator &&
  expected.timing.displayIntervalsSha256 ===
    actual.timing.displayIntervalsSha256 &&
  expected.timing.audio.length === actual.timing.audio.length &&
  expected.timing.audio.every((track, index) => {
    const output = actual.timing.audio[index];
    return (
      output !== undefined &&
      track.streamIndex === output.streamIndex &&
      track.codec === output.codec &&
      track.packets === output.packets &&
      track.timesSha256 === output.timesSha256 &&
      track.payloadSha256 === output.payloadSha256 &&
      track.configurationSha256 === output.configurationSha256
    );
  });

export const isCacheValidationMatching = (
  expected: CacheExpectation,
  actual: CacheValidation,
  requiredMode: CacheHardwareMode = 'full',
): boolean =>
  isCacheContentMatching(expected, actual) &&
  isCacheHardwareCoverageValid(
    actual.hardware.coverage,
    requiredMode,
    expected.timing.endNumerator / expected.timing.endDenominator,
  ) &&
  expected.runtime === actual.hardware.runtime &&
  actual.hardware.platformDecoder &&
  !actual.hardware.softwareFallback;

/** Linear estimate from a measured sample, not an ETA or a guaranteed file size. */
export const estimatePlaybackCache = (
  duration: number,
  sample: { duration: number; seconds: number; bytes: number },
): PlaybackCacheEstimate => {
  if (
    ![duration, sample.duration, sample.seconds, sample.bytes].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error('CACHE_INVALID_ESTIMATE');
  const result = {
    seconds: (duration / sample.duration) * sample.seconds,
    bytes: Math.ceil((duration / sample.duration) * sample.bytes),
  };
  if (!Number.isFinite(result.seconds) || !Number.isSafeInteger(result.bytes))
    throw new Error('CACHE_INVALID_ESTIMATE');
  return result;
};

export const hasCacheCapacity = (
  estimatedBytes: number,
  limits: { freeBytes: number; reserveBytes: number; maxBytes: number },
): boolean =>
  positive(estimatedBytes) &&
  positive(limits.freeBytes) &&
  positive(limits.maxBytes) &&
  Number.isSafeInteger(limits.reserveBytes) &&
  limits.reserveBytes >= 0 &&
  estimatedBytes <= limits.maxBytes &&
  estimatedBytes <= limits.freeBytes - limits.reserveBytes;
