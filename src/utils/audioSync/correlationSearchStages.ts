export interface AudioFeatureSeries {
  values: Float32Array;
  energies: Float32Array;
  frameRate: number;
  blockSize: number;
}

export interface CorrelationWindow {
  source: 'first' | 'second';
  startFrame: number;
  lengthFrames: number;
  quality: number;
}

export interface FeatureCorrelationCandidate {
  offsetFrames: number;
  correlation: number;
  rankScore: number;
  windowScores: number[];
  usableWindowCount: number;
  consistencyScore: number;
  anchorBaseFrame: number;
}

export interface RawCorrelationResult {
  offsetSamples: number;
  correlation: number;
}

const TARGET_FEATURE_RATE = 20;
const WINDOW_SECONDS = 4;
const MIN_WINDOW_SECONDS = 1.5;
const BROAD_STEP_SECONDS = 0.25;
const CANDIDATE_SEPARATION_SECONDS = 1;
const MAX_WINDOWS_PER_SOURCE = 4;
const MAX_COARSE_CANDIDATES = 8;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const yieldToEventLoop = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

const calculatePearson = (
  first: Float32Array,
  second: Float32Array,
  firstStart: number,
  secondStart: number,
  length: number,
): number => {
  if (length <= 1) return -1;
  let firstSum = 0;
  let secondSum = 0;
  let firstSquareSum = 0;
  let secondSquareSum = 0;
  let productSum = 0;

  for (let index = 0; index < length; index += 1) {
    const firstValue = first[firstStart + index] ?? 0;
    const secondValue = second[secondStart + index] ?? 0;
    firstSum += firstValue;
    secondSum += secondValue;
    firstSquareSum += firstValue * firstValue;
    secondSquareSum += secondValue * secondValue;
    productSum += firstValue * secondValue;
  }

  const numerator = productSum - (firstSum * secondSum) / length;
  const firstVariance = firstSquareSum - (firstSum * firstSum) / length;
  const secondVariance = secondSquareSum - (secondSum * secondSum) / length;
  const denominator = Math.sqrt(firstVariance * secondVariance);
  if (!Number.isFinite(denominator) || denominator <= 1e-12) return -1;
  return clamp(numerator / denominator, -1, 1);
};

export const buildCoarseAudioFeature = (
  data: Float32Array,
  sampleRate: number,
): AudioFeatureSeries => {
  const safeSampleRate = Math.max(1, sampleRate);
  const blockSize = Math.max(1, Math.round(safeSampleRate / TARGET_FEATURE_RATE));
  const frameCount = Math.floor(data.length / blockSize);
  const energies = new Float32Array(frameCount);
  const transformed = new Float32Array(frameCount);

  let transformedSum = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * blockSize;
    let sum = 0;
    let squareSum = 0;
    for (let sample = 0; sample < blockSize; sample += 1) {
      const value = data[start + sample] ?? 0;
      sum += value;
      squareSum += value * value;
    }
    const mean = sum / blockSize;
    const variance = Math.max(0, squareSum / blockSize - mean * mean);
    const rms = Math.sqrt(variance);
    energies[frame] = rms;
    const compressed = Math.log1p(rms * 100);
    transformed[frame] = compressed;
    transformedSum += compressed;
  }

  const values = new Float32Array(frameCount);
  if (frameCount > 0) {
    const mean = transformedSum / frameCount;
    let varianceSum = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const delta = (transformed[frame] ?? 0) - mean;
      varianceSum += delta * delta;
    }
    const standardDeviation = Math.sqrt(varianceSum / frameCount);
    if (standardDeviation > 1e-6) {
      for (let frame = 0; frame < frameCount; frame += 1) {
        values[frame] = ((transformed[frame] ?? 0) - mean) / standardDeviation;
      }
    }
  }

  return {
    values,
    energies,
    frameRate: safeSampleRate / blockSize,
    blockSize,
  };
};

const calculateWindowQuality = (
  feature: AudioFeatureSeries,
  startFrame: number,
  lengthFrames: number,
): number => {
  if (lengthFrames <= 1) return 0;
  let valueSum = 0;
  let valueSquareSum = 0;
  let energySum = 0;
  for (let index = 0; index < lengthFrames; index += 1) {
    const value = feature.values[startFrame + index] ?? 0;
    valueSum += value;
    valueSquareSum += value * value;
    energySum += feature.energies[startFrame + index] ?? 0;
  }
  const mean = valueSum / lengthFrames;
  const variance = Math.max(
    0,
    valueSquareSum / lengthFrames - mean * mean,
  );
  const meanEnergy = energySum / lengthFrames;
  if (meanEnergy <= 1e-7 || variance <= 0.01) return 0;
  return variance * Math.log1p(meanEnergy * 1000);
};

export const selectCorrelationWindows = (
  feature: AudioFeatureSeries,
  source: CorrelationWindow['source'],
): CorrelationWindow[] => {
  const preferredLength = Math.max(
    12,
    Math.round(feature.frameRate * WINDOW_SECONDS),
  );
  const minimumLength = Math.max(
    8,
    Math.round(feature.frameRate * MIN_WINDOW_SECONDS),
  );
  if (feature.values.length < minimumLength) return [];
  const step = Math.max(1, Math.floor(preferredLength / 2));
  const candidates: CorrelationWindow[] = [];

  for (
    let startFrame = 0;
    startFrame + minimumLength <= feature.values.length;
    startFrame += step
  ) {
    const lengthFrames = Math.min(
      preferredLength,
      feature.values.length - startFrame,
    );
    const quality = calculateWindowQuality(feature, startFrame, lengthFrames);
    if (quality <= 0) continue;
    candidates.push({ source, startFrame, lengthFrames, quality });
  }

  candidates.sort((left, right) => right.quality - left.quality);
  const selected: CorrelationWindow[] = [];
  const minimumSeparation = Math.max(1, Math.floor(preferredLength / 2));
  for (const candidate of candidates) {
    if (
      selected.some(
        (existing) =>
          Math.abs(existing.startFrame - candidate.startFrame) <
          minimumSeparation,
      )
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= MAX_WINDOWS_PER_SOURCE) break;
  }
  return selected;
};

const scoreWindowAtOffset = ({
  first,
  second,
  window,
  offsetFrames,
  minimumFrames,
}: {
  first: AudioFeatureSeries;
  second: AudioFeatureSeries;
  window: CorrelationWindow;
  offsetFrames: number;
  minimumFrames: number;
}): { score: number; baseStartFrame: number } | null => {
  let baseStart =
    window.source === 'first'
      ? window.startFrame
      : window.startFrame - offsetFrames;
  let baseEnd = baseStart + window.lengthFrames;
  baseStart = Math.max(baseStart, 0, -offsetFrames);
  baseEnd = Math.min(
    baseEnd,
    first.values.length,
    second.values.length - offsetFrames,
  );
  const length = baseEnd - baseStart;
  if (length < minimumFrames) return null;

  const score = calculatePearson(
    first.values,
    second.values,
    baseStart,
    baseStart + offsetFrames,
    length,
  );
  if (!Number.isFinite(score) || score <= -1) return null;
  return { score, baseStartFrame: baseStart };
};

const scoreFeatureOffset = ({
  first,
  second,
  windows,
  offsetFrames,
}: {
  first: AudioFeatureSeries;
  second: AudioFeatureSeries;
  windows: CorrelationWindow[];
  offsetFrames: number;
}): FeatureCorrelationCandidate | null => {
  const minimumFrames = Math.max(
    6,
    Math.round(first.frameRate * MIN_WINDOW_SECONDS),
  );
  const windowScores: number[] = [];
  let bestWindowScore = -Infinity;
  let anchorBaseFrame = Math.max(0, -offsetFrames);

  for (const window of windows) {
    const scored = scoreWindowAtOffset({
      first,
      second,
      window,
      offsetFrames,
      minimumFrames,
    });
    if (!scored) continue;
    windowScores.push(scored.score);
    if (scored.score > bestWindowScore) {
      bestWindowScore = scored.score;
      anchorBaseFrame = scored.baseStartFrame;
    }
  }
  if (windowScores.length === 0) return null;

  const correlation =
    windowScores.reduce((sum, score) => sum + score, 0) / windowScores.length;
  const coverage = Math.min(
    1,
    windowScores.length / Math.max(1, Math.min(4, windows.length)),
  );
  const rankScore =
    correlation >= 0
      ? correlation * (0.65 + 0.35 * coverage)
      : correlation;
  const consistencyThreshold = Math.max(0.15, correlation - 0.2);
  const consistencyScore =
    windowScores.filter((score) => score >= consistencyThreshold).length /
    windowScores.length;

  return {
    offsetFrames,
    correlation,
    rankScore,
    windowScores,
    usableWindowCount: windowScores.length,
    consistencyScore,
    anchorBaseFrame,
  };
};

const insertSeparatedCandidate = (
  candidates: FeatureCorrelationCandidate[],
  candidate: FeatureCorrelationCandidate,
  separationFrames: number,
): void => {
  const nearbyIndex = candidates.findIndex(
    (existing) =>
      Math.abs(existing.offsetFrames - candidate.offsetFrames) <
      separationFrames,
  );
  if (nearbyIndex >= 0) {
    const existing = candidates[nearbyIndex];
    if (existing && existing.rankScore >= candidate.rankScore) return;
    candidates.splice(nearbyIndex, 1);
  }
  candidates.push(candidate);
  candidates.sort((left, right) => right.rankScore - left.rankScore);
  if (candidates.length > MAX_COARSE_CANDIDATES) {
    candidates.length = MAX_COARSE_CANDIDATES;
  }
};

export const runBroadFeatureCorrelationSearch = async ({
  first,
  second,
  windows,
  maxOffsetSeconds,
  onProgress,
}: {
  first: AudioFeatureSeries;
  second: AudioFeatureSeries;
  windows: CorrelationWindow[];
  maxOffsetSeconds?: number;
  onProgress?: (progress: number) => void;
}): Promise<FeatureCorrelationCandidate[]> => {
  if (windows.length === 0 || first.values.length === 0 || second.values.length === 0) {
    return [];
  }
  const minimumOverlap = Math.max(
    6,
    Math.round(first.frameRate * MIN_WINDOW_SECONDS),
  );
  let minimumOffset = -first.values.length + minimumOverlap;
  let maximumOffset = second.values.length - minimumOverlap;
  if (
    maxOffsetSeconds !== undefined &&
    Number.isFinite(maxOffsetSeconds) &&
    maxOffsetSeconds >= 0
  ) {
    const explicitLimit = Math.round(maxOffsetSeconds * first.frameRate);
    minimumOffset = Math.max(minimumOffset, -explicitLimit);
    maximumOffset = Math.min(maximumOffset, explicitLimit);
  }
  if (minimumOffset > maximumOffset) return [];

  const step = Math.max(1, Math.round(first.frameRate * BROAD_STEP_SECONDS));
  const separation = Math.max(
    1,
    Math.round(first.frameRate * CANDIDATE_SEPARATION_SECONDS),
  );
  const total = Math.max(
    1,
    Math.floor((maximumOffset - minimumOffset) / step) + 1,
  );
  const candidates: FeatureCorrelationCandidate[] = [];
  let completed = 0;

  onProgress?.(0);
  for (
    let offsetFrames = minimumOffset;
    offsetFrames <= maximumOffset;
    offsetFrames += step
  ) {
    const candidate = scoreFeatureOffset({
      first,
      second,
      windows,
      offsetFrames,
    });
    if (candidate) {
      insertSeparatedCandidate(candidates, candidate, separation);
    }
    completed += 1;
    if (completed % 64 === 0) {
      onProgress?.(completed / total);
      await yieldToEventLoop();
    }
  }
  onProgress?.(1);
  return candidates;
};

export const runFineFeatureCorrelationSearch = ({
  first,
  second,
  windows,
  coarseCandidates,
}: {
  first: AudioFeatureSeries;
  second: AudioFeatureSeries;
  windows: CorrelationWindow[];
  coarseCandidates: FeatureCorrelationCandidate[];
}): FeatureCorrelationCandidate[] => {
  if (coarseCandidates.length === 0) return [];
  const rangeFrames = Math.max(
    2,
    Math.round(first.frameRate * BROAD_STEP_SECONDS * 1.5),
  );
  const separation = Math.max(
    1,
    Math.round(first.frameRate * CANDIDATE_SEPARATION_SECONDS),
  );
  const results: FeatureCorrelationCandidate[] = [];
  const seen = new Set<number>();

  for (const coarse of coarseCandidates.slice(0, 5)) {
    for (
      let offsetFrames = coarse.offsetFrames - rangeFrames;
      offsetFrames <= coarse.offsetFrames + rangeFrames;
      offsetFrames += 1
    ) {
      if (seen.has(offsetFrames)) continue;
      seen.add(offsetFrames);
      const candidate = scoreFeatureOffset({
        first,
        second,
        windows,
        offsetFrames,
      });
      if (candidate) {
        insertSeparatedCandidate(results, candidate, separation);
      }
    }
  }
  return results;
};

const calculateRawCorrelationAtOffset = ({
  first,
  second,
  offsetSamples,
  anchorBaseSample,
  windowLengthSamples,
}: {
  first: Float32Array;
  second: Float32Array;
  offsetSamples: number;
  anchorBaseSample: number;
  windowLengthSamples: number;
}): number => {
  const minimumStart = Math.max(0, -offsetSamples);
  const maximumEnd = Math.min(first.length, second.length - offsetSamples);
  const availableLength = maximumEnd - minimumStart;
  if (availableLength < 16) return -1;
  const length = Math.min(windowLengthSamples, availableLength);
  const maximumStart = maximumEnd - length;
  const firstStart = Math.round(
    clamp(anchorBaseSample, minimumStart, maximumStart),
  );
  return calculatePearson(
    first,
    second,
    firstStart,
    firstStart + offsetSamples,
    length,
  );
};

export const runRawCorrelationRefinement = async ({
  first,
  second,
  sampleRate,
  initialOffsetSeconds,
  anchorBaseSeconds,
  onProgress,
}: {
  first: Float32Array;
  second: Float32Array;
  sampleRate: number;
  initialOffsetSeconds: number;
  anchorBaseSeconds: number;
  onProgress?: (progress: number) => void;
}): Promise<RawCorrelationResult> => {
  const initialOffset = Math.round(initialOffsetSeconds * sampleRate);
  const anchorBaseSample = Math.round(anchorBaseSeconds * sampleRate);
  const windowLength = Math.max(32, Math.round(sampleRate * 0.4));
  const broadRange = Math.max(1, Math.round(sampleRate * 0.12));
  const broadStep = Math.max(1, Math.round(sampleRate / 1000));
  let bestOffset = initialOffset;
  let bestCorrelation = calculateRawCorrelationAtOffset({
    first,
    second,
    offsetSamples: initialOffset,
    anchorBaseSample,
    windowLengthSamples: windowLength,
  });

  const totalBroad = Math.max(1, Math.floor((broadRange * 2) / broadStep) + 1);
  let completed = 0;
  for (
    let offset = initialOffset - broadRange;
    offset <= initialOffset + broadRange;
    offset += broadStep
  ) {
    const correlation = calculateRawCorrelationAtOffset({
      first,
      second,
      offsetSamples: offset,
      anchorBaseSample,
      windowLengthSamples: windowLength,
    });
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
    completed += 1;
    if (completed % 24 === 0) {
      onProgress?.((completed / totalBroad) * 0.75);
      await yieldToEventLoop();
    }
  }

  const ultraRange = Math.max(1, Math.round(sampleRate * 0.004));
  const ultraTotal = ultraRange * 2 + 1;
  let ultraCompleted = 0;
  const center = bestOffset;
  for (let offset = center - ultraRange; offset <= center + ultraRange; offset += 1) {
    const correlation = calculateRawCorrelationAtOffset({
      first,
      second,
      offsetSamples: offset,
      anchorBaseSample,
      windowLengthSamples: windowLength,
    });
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
    ultraCompleted += 1;
    if (ultraCompleted % 32 === 0) {
      onProgress?.(0.75 + (ultraCompleted / ultraTotal) * 0.25);
      await yieldToEventLoop();
    }
  }
  onProgress?.(1);
  return { offsetSamples: bestOffset, correlation: bestCorrelation };
};
