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

const SYNC_VALUE_EPSILON = 1e-9;
export const PLAYBACK_OFFSET_EPSILON_SECONDS = 0.05;

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

/**
 * Commits a new second-angle synchronization value in the current format.
 * Reading legacy syncOffset-only data is supported, but once synchronization
 * is edited we always materialize angleOffsets so new writes do not perpetuate
 * the legacy-only representation.
 */
export const applySecondarySyncOffset = (
  syncData: VideoSyncData | undefined,
  syncOffset: number,
): VideoSyncData => {
  const angleOffsets = syncData?.angleOffsets
    ? [...syncData.angleOffsets]
    : [0, syncOffset];

  if (angleOffsets.length === 0) {
    angleOffsets.push(0);
  }
  angleOffsets[0] = 0;
  angleOffsets[1] = syncOffset;

  return {
    ...syncData,
    syncOffset,
    angleOffsets,
    isAnalyzed: true,
  };
};

/**
 * Resets only the legacy/two-angle synchronization channel. Explicit offsets
 * for angle 2 and later are preserved because they represent independent
 * multi-angle synchronization state.
 */
export const resetSecondarySyncOffset = (
  syncData: VideoSyncData | undefined,
): VideoSyncData => {
  const reset = applySecondarySyncOffset(syncData, 0);
  const hasOtherAngleSync =
    reset.angleOffsets?.some(
      (offset, index) =>
        index > 1 && Math.abs(offset) > SYNC_VALUE_EPSILON,
    ) ?? false;

  return {
    ...reset,
    isAnalyzed: hasOtherAngleSync,
    confidenceScore: 0,
  };
};
