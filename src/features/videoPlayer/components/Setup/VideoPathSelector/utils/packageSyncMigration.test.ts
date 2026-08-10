import { describe, expect, it } from 'vitest';
import type { VideoSyncData } from '../../../../../../types/video/sync';
import { migrateLoadedPackageSyncData } from './packageSyncMigration';

const syncData = (
  syncOffset: number,
  angleOffsets?: number[],
): VideoSyncData => ({
  syncOffset,
  angleOffsets,
  isAnalyzed: true,
});

describe('migrateLoadedPackageSyncData', () => {
  it('keeps legacy syncOffset-only packages unchanged', () => {
    expect(migrateLoadedPackageSyncData(syncData(1.25))).toEqual(
      syncData(1.25),
    );
  });

  it('repairs the known all-zero angleOffsets corruption from legacy syncOffset', () => {
    expect(migrateLoadedPackageSyncData(syncData(1.25, [0, 0]))).toEqual({
      syncOffset: 1.25,
      angleOffsets: [0, 1.25],
      isAnalyzed: true,
    });
  });

  it('treats explicit per-angle data as canonical for the compatibility field', () => {
    expect(
      migrateLoadedPackageSyncData(syncData(9, [0, -0.5, 0.75])),
    ).toEqual({
      syncOffset: -0.5,
      angleOffsets: [0, -0.5, 0.75],
      isAnalyzed: true,
    });
  });

  it('normalizes angle 0 to the global-clock invariant', () => {
    expect(migrateLoadedPackageSyncData(syncData(0.5, [4, 0.5]))).toEqual({
      syncOffset: 0.5,
      angleOffsets: [0, 0.5],
      isAnalyzed: true,
    });
  });
});
