import type { AudioAnalysisResult, WaveformData } from '../../types/video/sync';
import {
  buildCoarseAudioFeature,
  runBroadFeatureCorrelationSearch,
  runFineFeatureCorrelationSearch,
  runRawCorrelationRefinement,
  selectCorrelationWindows,
  type FeatureCorrelationCandidate,
} from './correlationSearchStages';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const EMPTY_RESULT: AudioAnalysisResult = {
  offsetSeconds: 0,
  confidence: 0,
  correlationPeak: 0,
  secondBestCorrelation: 0,
  consistencyScore: 0,
  usableWindowCount: 0,
};

const selectSecondSeparatedCandidate = (
  candidates: FeatureCorrelationCandidate[],
  best: FeatureCorrelationCandidate,
  frameRate: number,
): FeatureCorrelationCandidate | undefined => {
  const minimumSeparation = Math.max(1, Math.round(frameRate));
  return candidates.find(
    (candidate) =>
      candidate !== best &&
      Math.abs(candidate.offsetFrames - best.offsetFrames) >= minimumSeparation,
  );
};

const calculateConfidence = ({
  best,
  second,
  rawCorrelation,
  totalWindows,
}: {
  best: FeatureCorrelationCandidate;
  second?: FeatureCorrelationCandidate;
  rawCorrelation: number;
  totalWindows: number;
}): number => {
  const peakScore = clamp01((best.correlation - 0.15) / 0.75);
  const rawScore = clamp01((rawCorrelation - 0.15) / 0.75);
  const secondCorrelation = second?.correlation ?? -1;
  const marginScore = clamp01((best.correlation - secondCorrelation) / 0.2);
  const coverage = clamp01(
    best.usableWindowCount / Math.max(1, Math.min(4, totalWindows)),
  );
  const weighted =
    peakScore * 0.3 +
    rawScore * 0.25 +
    marginScore * 0.25 +
    best.consistencyScore * 0.15 +
    coverage * 0.05;
  const coveragePenalty = 0.4 + coverage * 0.6;
  const sparsePenalty = best.usableWindowCount >= 2 ? 1 : 0.6;
  return clamp01(weighted * coveragePenalty * sparsePenalty);
};

export const analyzePcmSyncByCorrelation = async (
  data1: Float32Array,
  data2: Float32Array,
  sampleRate: number,
  onProgress?: (progress: number) => void,
  maxOffsetSeconds?: number,
): Promise<AudioAnalysisResult> => {
  if (
    data1.length === 0 ||
    data2.length === 0 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  ) {
    return { ...EMPTY_RESULT };
  }

  let lastProgress = 0;
  const reportProgress = (progress: number): void => {
    const next = Math.max(lastProgress, clamp01(progress));
    lastProgress = next;
    onProgress?.(next);
  };

  reportProgress(0);
  const firstFeature = buildCoarseAudioFeature(data1, sampleRate);
  const secondFeature = buildCoarseAudioFeature(data2, sampleRate);
  const windows = [
    ...selectCorrelationWindows(firstFeature, 'first'),
    ...selectCorrelationWindows(secondFeature, 'second'),
  ];
  if (windows.length === 0) {
    reportProgress(1);
    return { ...EMPTY_RESULT };
  }

  const coarseCandidates = await runBroadFeatureCorrelationSearch({
    first: firstFeature,
    second: secondFeature,
    windows,
    maxOffsetSeconds,
    onProgress: (progress) => reportProgress(progress * 0.6),
  });
  if (coarseCandidates.length === 0) {
    reportProgress(1);
    return { ...EMPTY_RESULT };
  }

  reportProgress(0.62);
  const fineCandidates = runFineFeatureCorrelationSearch({
    first: firstFeature,
    second: secondFeature,
    windows,
    coarseCandidates,
  });
  const candidates = fineCandidates.length > 0 ? fineCandidates : coarseCandidates;
  const best = candidates[0];
  if (!best) {
    reportProgress(1);
    return { ...EMPTY_RESULT };
  }
  const second = selectSecondSeparatedCandidate(
    candidates,
    best,
    firstFeature.frameRate,
  );
  reportProgress(0.72);

  const featureOffsetSeconds = best.offsetFrames / firstFeature.frameRate;
  const anchorBaseSeconds = best.anchorBaseFrame / firstFeature.frameRate;
  const rawResult = await runRawCorrelationRefinement({
    first: data1,
    second: data2,
    sampleRate,
    initialOffsetSeconds: featureOffsetSeconds,
    anchorBaseSeconds,
    onProgress: (progress) => reportProgress(0.72 + progress * 0.28),
  });
  const refinedOffsetSeconds = rawResult.offsetSamples / sampleRate;
  const rawCorrelation = Number.isFinite(rawResult.correlation)
    ? rawResult.correlation
    : best.correlation;
  const confidence = calculateConfidence({
    best,
    second,
    rawCorrelation,
    totalWindows: windows.length,
  });

  reportProgress(1);
  return {
    offsetSeconds: refinedOffsetSeconds,
    confidence,
    correlationPeak: Math.max(best.correlation, rawCorrelation),
    secondBestCorrelation: second?.correlation ?? 0,
    consistencyScore: best.consistencyScore,
    usableWindowCount: best.usableWindowCount,
  };
};

export const analyzeSyncOffsetByCorrelation = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  maxOffsetSeconds?: number,
): Promise<AudioAnalysisResult> => {
  const data1 = waveform1.audioBuffer.getChannelData(0);
  const data2 = waveform2.audioBuffer.getChannelData(0);
  return analyzePcmSyncByCorrelation(
    data1,
    data2,
    waveform1.sampleRate,
    undefined,
    maxOffsetSeconds,
  );
};

export const runQuickCorrelationAnalysis = async (
  waveform1: WaveformData,
  waveform2: WaveformData,
  onProgress?: (progress: number) => void,
): Promise<AudioAnalysisResult> => {
  const data1 = waveform1.audioBuffer.getChannelData(0);
  const data2 = waveform2.audioBuffer.getChannelData(0);
  return analyzePcmSyncByCorrelation(
    data1,
    data2,
    waveform1.sampleRate,
    onProgress,
  );
};
