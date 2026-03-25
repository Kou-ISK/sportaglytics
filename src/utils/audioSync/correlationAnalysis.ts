import type { AudioAnalysisResult, WaveformData } from '../../types/VideoSync';
import { noopCorrelationLogger } from './correlationLogger';
import {
  runCoarseCorrelationSearch,
  runFineCorrelationSearch,
  runUltraFineCorrelationSearch,
} from './correlationSearchStages';

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
  let productSum = 0;

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
    productSum += val1 * val2;
  }

  const num = productSum - (sum1 * sum2) / sampleCount;
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

export const runQuickCorrelationAnalysis = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  onProgress?: (progress: number) => void,
): Promise<AudioAnalysisResult> => {
  const data1 = waveform1.audioBuffer.getChannelData(0);
  const data2 = waveform2.audioBuffer.getChannelData(0);
  const sampleRate = waveform1.sampleRate;
  const maxOffsetSamples = Math.floor(30 * sampleRate);
  const analysisLengthSamples = Math.floor(20 * sampleRate);
  const logger = noopCorrelationLogger;

  const coarseResult = runCoarseCorrelationSearch({
    data1,
    data2,
    analysisLengthSamples,
    sampleRate,
    maxOffsetSamples,
    logger,
    onProgress,
  });

  onProgress?.(0.5);

  const fineResult = runFineCorrelationSearch({
    data1,
    data2,
    analysisLengthSamples,
    sampleRate,
    initial: coarseResult,
    logger,
  });

  onProgress?.(0.8);

  const finalResult = runUltraFineCorrelationSearch({
    data1,
    data2,
    analysisLengthSamples,
    sampleRate,
    initial: fineResult,
    logger,
  });

  onProgress?.(1);

  const offsetSeconds = finalResult.offset / sampleRate;
  const confidence = Math.max(
    0,
    Math.min(1, (finalResult.correlation + 1) / 2),
  );

  return {
    offsetSeconds,
    confidence,
    correlationPeak: finalResult.correlation,
  };
};
