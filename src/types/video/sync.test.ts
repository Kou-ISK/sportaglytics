import { describe, expect, it } from 'vitest';
import {
  angleMediaTimeToGlobalTime,
  applySecondarySyncOffset,
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  resetSecondarySyncOffset,
  resolveAngleSyncOffset,
  resolvePlaybackAngleOffset,
  shouldBlockAnglePlayback,
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
  describe('timeline conversion contract', () => {
    it('uses angle 0 as the unshifted global clock', () => {
      expect(resolveAngleSyncOffset(syncData(1.25, [0, 1.25]), 0)).toBe(0);
    });

    it('prefers per-angle offsets and falls back to legacy syncOffset', () => {
      const data = syncData(1.25, [0, -0.5, 0.75]);
      expect(resolveAngleSyncOffset(data, 1)).toBe(-0.5);
      expect(resolveAngleSyncOffset(data, 2)).toBe(0.75);
      expect(resolveAngleSyncOffset(data, 3)).toBe(1.25);
    });

    it('does not apply unconfirmed sync data', () => {
      expect(
        resolveAngleSyncOffset(
          { syncOffset: 2, angleOffsets: [0, 2], isAnalyzed: false },
          1,
        ),
      ).toBe(0);
    });

    it('converts global and media time with one signed equation', () => {
      expect(globalTimeToAngleMediaTime(10, 2.5)).toBe(12.5);
      expect(globalTimeToAngleMediaTime(10, -2.5)).toBe(7.5);
      expect(angleMediaTimeToGlobalTime(12.5, 2.5)).toBe(10);
      expect(angleMediaTimeToGlobalTime(7.5, -2.5)).toBe(10);
    });

    it('blocks only while a negative-offset source has no media time yet', () => {
      expect(shouldBlockAnglePlayback(1, -2)).toBe(true);
      expect(shouldBlockAnglePlayback(2, -2)).toBe(false);
      expect(shouldBlockAnglePlayback(0, 2)).toBe(false);
      expect(clampAngleMediaTime(-1)).toBe(0);
    });

    it('does not stack angle offsets on absolute virtual clip placement', () => {
      expect(
        resolvePlaybackAngleOffset({
          syncData: syncData(1.5, [0, 1.5]),
          angleIndex: 1,
          syncMode: 'auto',
          usesVirtualTimeline: true,
        }),
      ).toBe(0);
      expect(
        resolvePlaybackAngleOffset({
          syncData: syncData(1.5, [0, 1.5]),
          angleIndex: 1,
          syncMode: 'auto',
          usesVirtualTimeline: false,
        }),
      ).toBe(1.5);
    });

    it('bypasses offsets while manually positioning clips', () => {
      expect(
        resolvePlaybackAngleOffset({
          syncData: syncData(1.5, [0, 1.5]),
          angleIndex: 1,
          syncMode: 'manual',
          usesVirtualTimeline: false,
        }),
      ).toBe(0);
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

  describe('resetSecondarySyncOffset', () => {
    it('clears the legacy/two-angle channel', () => {
      expect(resetSecondarySyncOffset(syncData(1.5, [0, 1.5]))).toEqual({
        syncOffset: 0,
        angleOffsets: [0, 0],
        isAnalyzed: false,
        confidenceScore: 0,
      });
    });

    it('preserves independent offsets for later angles', () => {
      expect(resetSecondarySyncOffset(syncData(1.5, [0, 1.5, 0.75]))).toEqual({
        syncOffset: 0,
        angleOffsets: [0, 0, 0.75],
        isAnalyzed: true,
        confidenceScore: 0,
      });
    });
  });
});
