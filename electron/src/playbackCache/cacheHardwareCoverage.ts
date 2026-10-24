import {
  arrayValue,
  booleanValue,
  integerValue,
  numberValue,
  objectValue,
} from '../../../src/shared/validation/jsonValues';

export type CacheHardwareMode = 'full' | 'compatibility';
export interface CacheProbeRange {
  start: number;
  end: number;
}
export interface CacheProbeSegment extends CacheProbeRange {
  firstClock: number;
  lastClock: number;
  first: number;
  last: number;
  frames: number;
  ended: boolean;
}
export type CacheHardwareCoverage =
  | { mode: 'full'; ended: true }
  | {
      mode: 'compatibility';
      duration: number;
      presentationEnd: number;
      segments: CacheProbeSegment[];
    };

/** Also serialized into the isolated page: keep this function self-contained.
 * Short files use one range; longer files have three disjoint two-second ranges. */
export const planCacheCompatibility = (duration: number): CacheProbeRange[] => {
  if (!Number.isFinite(duration) || duration <= 0)
    throw Error('CACHE_HARDWARE_DURATION');
  if (duration <= 6) return [{ start: 0, end: duration }];
  return [
    { start: 0, end: 2 },
    { start: duration / 2 - 1, end: duration / 2 + 1 },
    { start: duration - 2, end: duration },
  ];
};

/** This is a compatibility observation, not a frame completeness/quality proof.
 * Each range must cover its middle half by actual progressing frame callbacks.
 * The quarter-range margins allow callbacks to be sampled by the compositor;
 * they do not relax the exact full-content timestamp/audio checks. */
export const isCacheHardwareCoverageValid = (
  coverage: CacheHardwareCoverage,
  required: CacheHardwareMode,
  presentationEnd?: number,
): boolean => {
  if (!coverage || coverage.mode !== required) return false;
  if (coverage.mode === 'full') return coverage.ended === true;
  if (!Number.isFinite(coverage.duration) || coverage.duration <= 0)
    return false;
  if (
    !Number.isFinite(presentationEnd) ||
    !presentationEnd ||
    presentationEnd <= 0 ||
    coverage.presentationEnd !== presentationEnd
  )
    return false;
  const plan = planCacheCompatibility(coverage.duration);
  return (
    coverage.segments.length === plan.length &&
    plan.every((range, index) => {
      const observed = coverage.segments[index];
      const quarter = (range.end - range.start) / 4;
      return (
        observed.start === range.start &&
        observed.end === range.end &&
        Number.isSafeInteger(observed.frames) &&
        observed.frames >= 2 &&
        Number.isFinite(observed.first) &&
        Number.isFinite(observed.last) &&
        observed.firstClock >= range.start &&
        observed.firstClock <= range.start + quarter &&
        observed.lastClock >= range.end - quarter &&
        observed.lastClock <= Math.min(presentationEnd, range.end + quarter) &&
        observed.lastClock - observed.firstClock >= quarter * 2 &&
        // Both observations must address this source-clock interval. Do not
        // normalize PTS to duration or infer a new offset from sampled frames.
        // Native duration is a length and can exclude a nonzero stream origin;
        // currentTime and mediaTime are bounded by the verified timeline end.
        observed.first >= range.start &&
        observed.first <= range.start + quarter &&
        observed.last >= range.end - quarter &&
        observed.last <= Math.min(presentationEnd, range.end + quarter) &&
        observed.last > observed.first &&
        observed.last - observed.first >= quarter * 2 &&
        observed.last - observed.first <= range.end - range.start + quarter &&
        observed.ended === (index === plan.length - 1)
      );
    }) &&
    // Include progression before the first callback. The proof-bound tail may
    // extend beyond native duration, but never adds to the existing budget.
    coverage.segments.reduce(
      (total, segment) => total + segment.lastClock - segment.start,
      0,
    ) <= 7
  );
};

export const readCacheHardwareCoverage = (
  raw: unknown,
  mode: CacheHardwareMode,
  presentationEnd?: number,
): {
  coverage: CacheHardwareCoverage;
  frames: number;
  maximumTime: number;
} => {
  const state = objectValue(raw);
  if (
    state.completed !== true ||
    state.failed !== false ||
    state.ended !== (mode === 'full')
  )
    throw Error('CACHE_HARDWARE_INCOMPLETE');
  const frames = integerValue(state.frames, 1);
  const maximumTime = numberValue(state.maximumTime);
  if (maximumTime <= 0) throw Error('CACHE_HARDWARE_NO_FRAMES');
  const coverage: CacheHardwareCoverage =
    mode === 'full'
      ? { mode: 'full', ended: true }
      : {
          mode: 'compatibility',
          duration: numberValue(state.duration),
          presentationEnd: numberValue(presentationEnd),
          segments: arrayValue(state.segments, 1, 3).map((entry) => {
            const segment = objectValue(entry);
            return {
              start: numberValue(segment.start),
              end: numberValue(segment.end),
              firstClock: numberValue(segment.firstClock),
              lastClock: numberValue(segment.lastClock),
              first: numberValue(segment.first),
              last: numberValue(segment.last),
              frames: integerValue(segment.frames, 2),
              ended: booleanValue(segment.ended),
            };
          }),
        };
  if (!isCacheHardwareCoverageValid(coverage, mode, presentationEnd))
    throw Error('CACHE_HARDWARE_COVERAGE');
  return { coverage, frames, maximumTime };
};
