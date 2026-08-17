export interface RecordingRangeInput {
  startTime: number;
  endTime: number;
  leadTimeSeconds?: number;
  lagTimeSeconds?: number;
  maxTime?: number;
}

export interface RecordingRange {
  startTime: number;
  endTime: number;
}

const toNonNegativeFinite = (value: number | undefined): number => {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
};

/**
 * Resolves the final timeline range for a coding action.
 *
 * The function is intentionally independent from React/player state so manual
 * coding and future automatic event detection can share the same range rules.
 */
export const resolveRecordingRange = ({
  startTime,
  endTime,
  leadTimeSeconds,
  lagTimeSeconds,
  maxTime,
}: RecordingRangeInput): RecordingRange => {
  const normalizedStart = toNonNegativeFinite(startTime);
  const normalizedEnd = toNonNegativeFinite(endTime);
  const begin = Math.min(normalizedStart, normalizedEnd);
  const end = Math.max(normalizedStart, normalizedEnd);
  const lead = toNonNegativeFinite(leadTimeSeconds);
  const lag = toNonNegativeFinite(lagTimeSeconds);

  let resolvedStart = Math.max(0, begin - lead);
  let resolvedEnd = Math.max(resolvedStart, end + lag);

  if (typeof maxTime === 'number' && Number.isFinite(maxTime)) {
    const normalizedMax = Math.max(0, maxTime);
    resolvedStart = Math.min(resolvedStart, normalizedMax);
    resolvedEnd = Math.min(Math.max(resolvedStart, resolvedEnd), normalizedMax);
  }

  return {
    startTime: resolvedStart,
    endTime: resolvedEnd,
  };
};
