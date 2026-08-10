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
export const PLAYBACK_OFFSET_EPSILON_SECONDS = 0.05;

const isEffectivelyZero = (value: number): boolean =>
  Math.abs(value) <= SYNC_OFFSET_EPSILON;

/**
 * Returns the persisted angle-level offset for an angle.
 *
 * Contract: angle 0 is the global clock and is always 0. Synchronization is
 * active only after analysis/manual confirmation. Legacy two-angle packages
 * fall back to syncOffset for angle 1 and any missing secondary entry.
 */
export const resolveAngleSyncOffset = (
  syncData: VideoSyncData | undefined,
  angleIndex: number,
): number => {
  if (angleIndex <= 0 || !syncData?.isAnalyzed) {
    return 0;
  }
  return syncData.angleOffsets?.[angleIndex] ?? syncData.syncOffset ?? 0;
};

/**
 * Resolves the offset that may actually be applied by the playback layer.
 * A virtual clip timeline already stores absolute placement on the common
 * timeline, so applying an angle-level offset on top would double-correct it.
 */
export const resolvePlaybackAngleOffset = ({
  syncData,
  angleIndex,
  syncMode,
  usesVirtualTimeline,
}: {
  syncData: VideoSyncData | undefined;
  angleIndex: number;
  syncMode: 'auto' | 'manual';
  usesVirtualTimeline: boolean;
}): number => {
  if (syncMode === 'manual' || usesVirtualTimeline) {
    return 0;
  }
  return resolveAngleSyncOffset(syncData, angleIndex);
};

/** Global/common timeline -> source media time. */
export const globalTimeToAngleMediaTime = (
  globalTime: number,
  angleOffset: number,
): number => globalTime + angleOffset;

/** Source media time -> global/common timeline. */
export const angleMediaTimeToGlobalTime = (
  mediaTime: number,
  angleOffset: number,
): number => mediaTime - angleOffset;

export const clampAngleMediaTime = (mediaTime: number): number =>
  Math.max(0, mediaTime);

export const shouldBlockAnglePlayback = (
  globalTime: number,
  angleOffset: number,
  epsilonSeconds = PLAYBACK_OFFSET_EPSILON_SECONDS,
): boolean =>
  globalTimeToAngleMediaTime(globalTime, angleOffset) < -epsilonSeconds;

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
