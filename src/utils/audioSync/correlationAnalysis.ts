import type { AudioAnalysisResult, WaveformData } from '../../types/VideoSync';

const calculateCorrelation = (
  data1: Float32Array,
  data2: Float32Array,
  offset: number,
): number => {
  const length = Math.min(data1.length, data2.length - Math.abs(offset));
  const sampleCount = Math.min(length, 44100 * 5);

  if (sampleCount <= 0) return 0;

  let sum1 = 0;
  let sum2 = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  let pSum = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const idx1 = offset >= 0 ? i : i - offset;
    const idx2 = offset >= 0 ? i + offset : i;

    if (idx1 < 0 || idx1 >= data1.length || idx2 < 0 || idx2 >= data2.length) {
      continue;
    }

    const val1 = data1[idx1];
    const val2 = data2[idx2];

    sum1 += val1;
    sum2 += val2;
    sum1Sq += val1 * val1;
    sum2Sq += val2 * val2;
    pSum += val1 * val2;
  }

  const num = pSum - (sum1 * sum2) / sampleCount;
  const den = Math.sqrt(
    (sum1Sq - (sum1 * sum1) / sampleCount) *
      (sum2Sq - (sum2 * sum2) / sampleCount),
  );

  return den === 0 ? 0 : num / den;
};

export const analyzeSyncOffsetByCorrelation = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  maxOffsetSeconds = 30,
): Promise<AudioAnalysisResult> => {
  const maxOffsetSamples = Math.floor(maxOffsetSeconds * waveform1.sampleRate);
  const data1 = waveform1.audioBuffer.getChannelData(0);
  const data2 = waveform2.audioBuffer.getChannelData(0);

  let bestOffset = 0;
  let bestCorrelation = -1;

  for (
    let offset = -maxOffsetSamples;
    offset <= maxOffsetSamples;
    offset += 100
  ) {
    const correlation = calculateCorrelation(data1, data2, offset);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  const offsetSeconds = bestOffset / waveform1.sampleRate;
  const confidence = Math.min(bestCorrelation * 2, 1);

  return {
    offsetSeconds,
    confidence,
    correlationPeak: bestCorrelation,
  };
};

const calculateSimpleCorrelation = (
  data1: Float32Array,
  data2: Float32Array,
  offset: number,
  analysisLength: number,
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
      console.warn('相関計算: 範囲不正', {
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

export const runQuickCorrelationAnalysis = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  onProgress?: (progress: number) => void,
): Promise<AudioAnalysisResult> => {
  const data1 = waveform1.audioBuffer.getChannelData(0);
  const data2 = waveform2.audioBuffer.getChannelData(0);
  const sampleRate = waveform1.sampleRate;

  const maxOffsetSeconds = 30;
  const maxOffsetSamples = Math.floor(maxOffsetSeconds * sampleRate);
  const analysisLengthSeconds = 20;
  const analysisLengthSamples = Math.floor(analysisLengthSeconds * sampleRate);

  console.log('クロスコリレーション分析開始:', {
    maxOffsetSeconds,
    analysisLengthSeconds,
    sampleRate,
    data1Length: data1.length,
    data2Length: data2.length,
  });

  let bestOffset = 0;
  let bestCorrelation = -Infinity;

  const coarseStep = Math.floor(sampleRate * 0.02);
  console.log(
    '粗探索開始: step =',
    coarseStep,
    'samples (',
    ((coarseStep / sampleRate) * 1000).toFixed(1),
    'ms)',
  );
  onProgress?.(0);

  let searchCount = 0;
  const totalSearches = Math.floor((maxOffsetSamples * 2) / coarseStep);

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
    );

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      console.log('新しい最良オフセット:', {
        offsetSamples: bestOffset,
        offsetSeconds: (bestOffset / sampleRate).toFixed(3),
        correlation: bestCorrelation.toFixed(4),
      });
    }

    searchCount += 1;
    if (searchCount % 100 === 0) {
      onProgress?.((searchCount / totalSearches) * 0.4);
    }
  }

  console.log('粗探索完了:', {
    offsetSamples: bestOffset,
    offsetSeconds: (bestOffset / sampleRate).toFixed(3),
    correlation: bestCorrelation.toFixed(4),
    searchCount,
  });

  onProgress?.(0.5);

  const fineStep = Math.floor(sampleRate / 30);
  const fineRange = Math.floor(sampleRate * 2);
  let refinedOffset = bestOffset;
  let refinedCorrelation = bestCorrelation;

  console.log('精密探索開始:', {
    centerOffset: bestOffset,
    fineStep,
    fineRange,
    searchRange: `${((bestOffset - fineRange) / sampleRate).toFixed(2)}s to ${((bestOffset + fineRange) / sampleRate).toFixed(2)}s`,
  });

  for (
    let offset = bestOffset - fineRange;
    offset <= bestOffset + fineRange;
    offset += fineStep
  ) {
    const correlation = calculateSimpleCorrelation(
      data1,
      data2,
      offset,
      analysisLengthSamples,
    );

    if (correlation > refinedCorrelation) {
      refinedCorrelation = correlation;
      refinedOffset = offset;
      console.log('精密探索で改善:', {
        offsetSamples: refinedOffset,
        offsetSeconds: (refinedOffset / sampleRate).toFixed(3),
        correlation: refinedCorrelation.toFixed(4),
      });
    }
  }

  console.log('精密探索完了:', {
    offsetSamples: refinedOffset,
    offsetSeconds: (refinedOffset / sampleRate).toFixed(3),
    offsetFrames:
      `${((refinedOffset / sampleRate) * 30).toFixed(2)} frames @ 30fps`,
    offsetMs: `${Math.round((refinedOffset / sampleRate) * 1000)}ms`,
    correlation: refinedCorrelation.toFixed(4),
    improvement: (refinedCorrelation - bestCorrelation).toFixed(4),
  });

  onProgress?.(0.8);

  const ultraFineRange = Math.floor(sampleRate * 0.2);
  let finalOffset = refinedOffset;
  let finalCorrelation = refinedCorrelation;

  console.log('超精密探索開始:', {
    centerOffset: refinedOffset,
    ultraFineRange,
    searchRange: `${((refinedOffset - ultraFineRange) / sampleRate).toFixed(4)}s to ${((refinedOffset + ultraFineRange) / sampleRate).toFixed(4)}s`,
    stepSize: '1 sample',
  });

  for (
    let offset = refinedOffset - ultraFineRange;
    offset <= refinedOffset + ultraFineRange;
    offset += 1
  ) {
    const correlation = calculateSimpleCorrelation(
      data1,
      data2,
      offset,
      analysisLengthSamples,
    );

    if (correlation > finalCorrelation) {
      finalCorrelation = correlation;
      finalOffset = offset;
    }
  }

  console.log('超精密探索完了:', {
    offsetSamples: finalOffset,
    offsetSeconds: (finalOffset / sampleRate).toFixed(6),
    offsetFrames:
      `${((finalOffset / sampleRate) * 30).toFixed(4)} frames @ 30fps`,
    offsetMs: `${((finalOffset / sampleRate) * 1000).toFixed(3)}ms`,
    correlation: finalCorrelation.toFixed(6),
    improvement: (finalCorrelation - refinedCorrelation).toFixed(6),
    totalImprovement: (finalCorrelation - bestCorrelation).toFixed(6),
  });

  onProgress?.(1);

  const offsetSeconds = finalOffset / sampleRate;
  const confidence = Math.max(0, Math.min(1, (finalCorrelation + 1) / 2));

  return {
    offsetSeconds,
    confidence,
    correlationPeak: finalCorrelation,
  };
};
