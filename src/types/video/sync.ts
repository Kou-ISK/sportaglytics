export interface VideoSyncData {
  syncOffset: number;
  angleOffsets?: number[];
  isAnalyzed: boolean;
  waveformData?: Float32Array;
  confidenceScore?: number;
}

export interface AudioAnalysisResult {
  offsetSeconds: number;
  confidence: number;
  correlationPeak: number;
}

export interface WaveformData {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  peaks: number[];
}

const SYNC_OFFSET_EPSILON = 1e-9;

const isEffectivelyZero = (value: number): boolean =>
  Math.abs(value) <= SYNC_OFFSET_EPSILON;

export const applySecondarySyncOffset = (
  syncData: VideoSyncData | undefined,
  syncOffset: number,
): VideoSyncData => {
  const existingAngleOffsets = syncData?.angleOffsets;
  let angleOffsets: number[] | undefined;

  if (existingAngleOffsets) {
    angleOffsets = [...existingAngleOffsets];
    if (angleOffsets.length === 0) {
      angleOffsets.push(0);
    }
    angleOffsets[0] = 0;
    angleOffsets[1] = syncOffset;
  }

  return {
    ...syncData,
    syncOffset,
    angleOffsets,
    isAnalyzed: true,
  };
};

export const resolveLoadedAngleOffsets = ({
  persistedSyncData,
  derivedAngleOffsets,
}: {
  persistedSyncData: VideoSyncData | undefined;
  derivedAngleOffsets: number[];
}): number[] | undefined => {
  const persistedAngleOffsets = persistedSyncData?.angleOffsets;
  const hasDerivedAngleOffset = derivedAngleOffsets.some(
    (offset) => !isEffectivelyZero(offset),
  );

  if (!persistedAngleOffsets && !hasDerivedAngleOffset) {
    return undefined;
  }

  const angleOffsets = derivedAngleOffsets.map(
    (derivedOffset, index) =>
      persistedAngleOffsets?.[index] ?? derivedOffset,
  );

  if (angleOffsets.length > 0) {
    angleOffsets[0] = 0;
  }

  const persistedOffsetsWereAllZero =
    persistedAngleOffsets !== undefined &&
    persistedAngleOffsets.length > 1 &&
    persistedAngleOffsets.every(isEffectivelyZero);
  const legacySecondaryOffset = persistedSyncData?.syncOffset ?? 0;

  // v0.8.3以前のローダーは、ローカル動画の保存済みsyncOffsetを
  // angleOffsets: [0, 0, ...]で上書きし、その値をconfig.jsonへ再保存していた。
  // その壊れた状態だけを識別し、従来の第2アングル用syncOffsetから復旧する。
  if (
    angleOffsets.length > 1 &&
    persistedOffsetsWereAllZero &&
    !isEffectivelyZero(legacySecondaryOffset)
  ) {
    angleOffsets[1] = legacySecondaryOffset;
  }

  return angleOffsets;
};
