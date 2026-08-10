import { describe, expect, it } from 'vitest';
import {
  applySecondarySyncOffset,
  resolveLoadedAngleOffsets,
  type VideoSyncData,
} from './sync';

const syncData = (
  syncOffset: number,
  angleOffsets?: number[],
): VideoSyncData => ({
  syncOffset,
  angleOffsets,
  isAnalyzed: true,
});

describe('video sync data helpers', () => {
  describe('resolveLoadedAngleOffsets', () => {
    it('keeps angleOffsets undefined for local two-angle packages that only persist legacy syncOffset', () => {
      expect(
        resolveLoadedAngleOffsets({
          persistedSyncData: syncData(1.25),
          derivedAngleOffsets: [0, 0],
        }),
      ).toBeUndefined();
    });

    it('repairs the v0.8.3 all-zero angleOffsets corruption from syncOffset', () => {
      expect(
        resolveLoadedAngleOffsets({
          persistedSyncData: syncData(1.25, [0, 0]),
          derivedAngleOffsets: [0, 0],
        }),
      ).toEqual([0, 1.25]);
    });

    it('preserves explicit persisted per-angle offsets', () => {
      expect(
        resolveLoadedAngleOffsets({
          persistedSyncData: syncData(-0.5, [0, -0.5, 0.75]),
          derivedAngleOffsets: [0, 0, 0],
        }),
      ).toEqual([0, -0.5, 0.75]);
    });

    it('uses derived offsets when package media supplies them', () => {
      expect(
        resolveLoadedAngleOffsets({
          persistedSyncData: undefined,
          derivedAngleOffsets: [0, -2],
        }),
      ).toEqual([0, -2]);
    });
  });

  describe('applySecondarySyncOffset', () => {
    it('updates syncOffset and the existing second angle together', () => {
      expect(applySecondarySyncOffset(syncData(0, [0, 0, 0.75]), 1.5)).toEqual({
        syncOffset: 1.5,
        angleOffsets: [0, 1.5, 0.75],
        isAnalyzed: true,
      });
    });

    it('keeps legacy angleOffsets absent when none existed', () => {
      expect(applySecondarySyncOffset(syncData(0), -0.25)).toEqual({
        syncOffset: -0.25,
        angleOffsets: undefined,
        isAnalyzed: true,
      });
    });
  });
});
