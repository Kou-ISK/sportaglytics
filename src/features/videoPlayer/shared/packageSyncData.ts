import type { VideoSyncData } from '../../../types/video/sync';

const OFFSET_EPSILON = 1e-9;

interface RuntimeAngleIndex {
  configIndex?: number;
}

const isEffectivelyZero = (value: number): boolean =>
  Math.abs(value) <= OFFSET_EPSILON;

const resolveConfigIndex = (
  angle: RuntimeAngleIndex | undefined,
  runtimeIndex: number,
): number => angle?.configIndex ?? runtimeIndex;

/**
 * Converts config.json sync state into runtime playback order.
 *
 * Persisted angleOffsets are indexed by config.json angles[]. Runtime playback
 * may reorder primary/secondary to indexes 0/1, so array positions must never
 * be reused without this mapping.
 */
export const loadRuntimeSyncData = (
  persistedSyncData: VideoSyncData | undefined,
  runtimeAngles: RuntimeAngleIndex[],
): VideoSyncData | undefined => {
  if (!persistedSyncData) {
    return undefined;
  }

  const persistedOffsets = persistedSyncData.angleOffsets;
  if (!persistedOffsets || persistedOffsets.length === 0) {
    return persistedSyncData;
  }

  const normalizedPersistedOffsets = [...persistedOffsets];
  const primaryConfigIndex = resolveConfigIndex(runtimeAngles[0], 0);
  const secondaryConfigIndex = resolveConfigIndex(runtimeAngles[1], 1);

  if (primaryConfigIndex < normalizedPersistedOffsets.length) {
    normalizedPersistedOffsets[primaryConfigIndex] = 0;
  }

  const allPersistedOffsetsWereZero =
    normalizedPersistedOffsets.length > 1 &&
    normalizedPersistedOffsets.every(isEffectivelyZero);
  const legacySecondaryOffset = persistedSyncData.syncOffset;

  // v0.8.3 could persist [0, 0, ...] over a valid legacy syncOffset. Repair
  // that known state at the persisted secondary angle identity, not index 1.
  if (
    allPersistedOffsetsWereZero &&
    !isEffectivelyZero(legacySecondaryOffset)
  ) {
    while (normalizedPersistedOffsets.length <= secondaryConfigIndex) {
      normalizedPersistedOffsets.push(0);
    }
    normalizedPersistedOffsets[secondaryConfigIndex] = legacySecondaryOffset;
  }

  const runtimeOffsets = runtimeAngles.map((angle, runtimeIndex) => {
    if (runtimeIndex === 0) {
      return 0;
    }
    const configIndex = resolveConfigIndex(angle, runtimeIndex);
    return normalizedPersistedOffsets[configIndex] ?? legacySecondaryOffset;
  });

  return {
    ...persistedSyncData,
    syncOffset: runtimeOffsets[1] ?? persistedSyncData.syncOffset,
    angleOffsets: runtimeOffsets,
  };
};

/**
 * Converts runtime playback order back to config.json angles[] order before
 * persistence. The compatibility syncOffset always mirrors runtime angle 1.
 */
export const toPersistedSyncData = (
  runtimeSyncData: VideoSyncData,
  runtimeAngles: RuntimeAngleIndex[],
): VideoSyncData => {
  const runtimeOffsets = runtimeSyncData.angleOffsets;
  if (!runtimeOffsets || runtimeOffsets.length === 0) {
    return runtimeSyncData;
  }

  const maxConfigIndex = runtimeAngles.reduce(
    (maximum, angle, runtimeIndex) =>
      Math.max(maximum, resolveConfigIndex(angle, runtimeIndex)),
    0,
  );
  const persistedOffsets = Array.from(
    { length: maxConfigIndex + 1 },
    () => 0,
  );

  runtimeAngles.forEach((angle, runtimeIndex) => {
    const configIndex = resolveConfigIndex(angle, runtimeIndex);
    persistedOffsets[configIndex] =
      runtimeIndex === 0
        ? 0
        : (runtimeOffsets[runtimeIndex] ?? runtimeSyncData.syncOffset);
  });

  return {
    ...runtimeSyncData,
    syncOffset: runtimeOffsets[1] ?? runtimeSyncData.syncOffset,
    angleOffsets: persistedOffsets,
  };
};
