import type { CorrelationLogger } from './correlationLogger';

export interface CorrelationSearchResult {
  offset: number;
  correlation: number;
}

interface CorrelationStageParams {
  data1: Float32Array;
  data2: Float32Array;
  analysisLengthSamples: number;
  sampleRate: number;
  logger: CorrelationLogger;
}

const calculateSimpleCorrelation = (
  data1: Float32Array,
  data2: Float32Array,
  offset: number,
  analysisLength: number,
  logger: CorrelationLogger,
): number => {
  let sum1 = 0;
  let sum2 = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  let productSum = 0;
  let validSamples = 0;

  const start1 = Math.max(0, -offset);
  const start2 = Math.max(0, offset);
  const maxLength = Math.min(
    analysisLength,
    data1.length - start1,
    data2.length - start2,
  );

  if (maxLength <= 0) {
    if (offset === 0 || Math.abs(offset) < 100) {
      logger.warn('相関計算: 範囲不正', {
        offset,
        start1,
        start2,
        maxLength,
        data1Length: data1.length,
        data2Length: data2.length,
      });
    }
    return -1;
  }

  for (let i = 0; i < maxLength; i += 1) {
    const idx1 = start1 + i;
    const idx2 = start2 + i;

    if (idx1 >= data1.length || idx2 >= data2.length) {
      break;
    }

    const val1 = data1[idx1];
    const val2 = data2[idx2];
    sum1 += val1;
    sum2 += val2;
    sum1Sq += val1 * val1;
    sum2Sq += val2 * val2;
    productSum += val1 * val2;
    validSamples += 1;
  }

  if (validSamples === 0) return -1;

  const mean1 = sum1 / validSamples;
  const mean2 = sum2 / validSamples;
  const variance1 = sum1Sq / validSamples - mean1 * mean1;
  const variance2 = sum2Sq / validSamples - mean2 * mean2;

  if (variance1 <= 0 || variance2 <= 0) return -1;

  const covariance = productSum / validSamples - mean1 * mean2;
  return covariance / Math.sqrt(variance1 * variance2);
};

export const runCoarseCorrelationSearch = (
  params: CorrelationStageParams & {
    maxOffsetSamples: number;
    onProgress?: (progress: number) => void;
  },
): CorrelationSearchResult => {
  const {
    data1,
    data2,
    analysisLengthSamples,
    sampleRate,
    maxOffsetSamples,
    logger,
    onProgress,
  } = params;
  const coarseStep = Math.floor(sampleRate * 0.02);
  let bestOffset = 0;
  let bestCorrelation = -Infinity;
  let searchCount = 0;
  const totalSearches = Math.max(
    1,
    Math.floor((maxOffsetSamples * 2) / coarseStep),
  );

  logger.debug('粗探索開始', {
    coarseStep,
    coarseStepMs: Number(((coarseStep / sampleRate) * 1000).toFixed(1)),
  });
  onProgress?.(0);

  for (
    let offset = -maxOffsetSamples;
    offset <= maxOffsetSamples;
    offset += coarseStep
  ) {
    const correlation = calculateSimpleCorrelation(
      data1,
      data2,
      offset,
      analysisLengthSamples,
      logger,
    );

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }

    searchCount += 1;
    if (searchCount % 100 === 0) {
      onProgress?.((searchCount / totalSearches) * 0.4);
    }
  }

  logger.debug('粗探索完了', {
    offsetSamples: bestOffset,
    offsetSeconds: Number((bestOffset / sampleRate).toFixed(3)),
    correlation: Number(bestCorrelation.toFixed(4)),
    searchCount,
  });

  return { offset: bestOffset, correlation: bestCorrelation };
};

export const runFineCorrelationSearch = (
  params: CorrelationStageParams & {
    initial: CorrelationSearchResult;
  },
): CorrelationSearchResult => {
  const { data1, data2, analysisLengthSamples, sampleRate, initial, logger } =
    params;
  const fineStep = Math.floor(sampleRate / 30);
  const fineRange = Math.floor(sampleRate * 2);
  let bestOffset = initial.offset;
  let bestCorrelation = initial.correlation;

  logger.debug('精密探索開始', {
    centerOffset: initial.offset,
    fineStep,
    fineRange,
  });

  for (
    let offset = initial.offset - fineRange;
    offset <= initial.offset + fineRange;
    offset += fineStep
  ) {
    const correlation = calculateSimpleCorrelation(
      data1,
      data2,
      offset,
      analysisLengthSamples,
      logger,
    );

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  logger.debug('精密探索完了', {
    offsetSamples: bestOffset,
    offsetSeconds: Number((bestOffset / sampleRate).toFixed(3)),
    correlation: Number(bestCorrelation.toFixed(4)),
  });

  return { offset: bestOffset, correlation: bestCorrelation };
};

export const runUltraFineCorrelationSearch = (
  params: CorrelationStageParams & {
    initial: CorrelationSearchResult;
  },
): CorrelationSearchResult => {
  const { data1, data2, analysisLengthSamples, sampleRate, initial, logger } =
    params;
  const ultraFineRange = Math.floor(sampleRate * 0.2);
  let bestOffset = initial.offset;
  let bestCorrelation = initial.correlation;

  logger.debug('超精密探索開始', {
    centerOffset: initial.offset,
    ultraFineRange,
  });

  for (
    let offset = initial.offset - ultraFineRange;
    offset <= initial.offset + ultraFineRange;
    offset += 1
  ) {
    const correlation = calculateSimpleCorrelation(
      data1,
      data2,
      offset,
      analysisLengthSamples,
      logger,
    );

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  logger.debug('超精密探索完了', {
    offsetSamples: bestOffset,
    offsetSeconds: Number((bestOffset / sampleRate).toFixed(6)),
    correlation: Number(bestCorrelation.toFixed(6)),
  });

  return { offset: bestOffset, correlation: bestCorrelation };
};
