import type { VideoSyncData } from '../../../../../../types/video/sync';

const OFFSET_EPSILON = 1e-9;

const isEffectivelyZero = (value: number): boolean =>
  Math.abs(value) <= OFFSET_EPSILON;

/**
 * Normalizes persisted package sync data at the package-load boundary.
 *
 * angleOffsets is the current per-angle representation. syncOffset remains a
 * persisted compatibility field and must mirror angleOffsets[1] whenever that
 * entry is trustworthy. v0.8.3 could persist an all-zero angleOffsets array
 * over a valid non-zero legacy syncOffset; that known corruption is repaired
 * before the renderer receives runtime state.
 */
export const migrateLoadedPackageSyncData = (
  persistedSyncData: VideoSyncData | undefined,
): VideoSyncData | undefined => {
  if (!persistedSyncData) {
    return undefined;
  }

  const persistedOffsets = persistedSyncData.angleOffsets;
  if (!persistedOffsets || persistedOffsets.length === 0) {
    return persistedSyncData;
  }

  const angleOffsets = [...persistedOffsets];
  angleOffsets[0] = 0;

  const allPersistedOffsetsWereZero =
    angleOffsets.length > 1 && angleOffsets.every(isEffectivelyZero);
  const legacySecondaryOffset = persistedSyncData.syncOffset;

  if (
    allPersistedOffsetsWereZero &&
    !isEffectivelyZero(legacySecondaryOffset)
  ) {
    angleOffsets[1] = legacySecondaryOffset;
    return {
      ...persistedSyncData,
      angleOffsets,
    };
  }

  const secondaryOffset = angleOffsets[1];
  return {
    ...persistedSyncData,
    syncOffset:
      typeof secondaryOffset === 'number'
        ? secondaryOffset
        : persistedSyncData.syncOffset,
    angleOffsets,
  };
};
