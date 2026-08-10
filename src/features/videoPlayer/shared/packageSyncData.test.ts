import { describe, expect, it } from 'vitest';
import type { VideoSyncData } from '../../../types/video/sync';
import { loadRuntimeSyncData, toPersistedSyncData } from './packageSyncData';

const syncData = (
  syncOffset: number,
  angleOffsets?: number[],
): VideoSyncData => ({
  syncOffset,
  angleOffsets,
  isAnalyzed: true,
});

const reorderedAngles = [
  { configIndex: 2 },
  { configIndex: 1 },
  { configIndex: 0 },
];

describe('package sync angle order mapping', () => {
  it('keeps legacy syncOffset-only packages unchanged', () => {
    expect(loadRuntimeSyncData(syncData(1.25), reorderedAngles)).toEqual(
      syncData(1.25),
    );
  });

  it('maps persisted config order into runtime primary/secondary order', () => {
    expect(
      loadRuntimeSyncData(syncData(-0.5, [0.75, -0.5, 0]), reorderedAngles),
    ).toEqual({
      syncOffset: -0.5,
      angleOffsets: [0, -0.5, 0.75],
      isAnalyzed: true,
    });
  });

  it('repairs the known all-zero corruption at the secondary config index', () => {
    expect(
      loadRuntimeSyncData(syncData(1.25, [0, 0, 0]), reorderedAngles),
    ).toEqual({
      syncOffset: 1.25,
      angleOffsets: [0, 1.25, 0],
      isAnalyzed: true,
    });
  });

  it('maps runtime offsets back to persisted config order', () => {
    expect(
      toPersistedSyncData(
        syncData(-0.5, [0, -0.5, 0.75]),
        reorderedAngles,
      ),
    ).toEqual({
      syncOffset: -0.5,
      angleOffsets: [0.75, -0.5, 0],
      isAnalyzed: true,
    });
  });

  it('uses runtime index as a compatibility fallback when configIndex is absent', () => {
    expect(
      toPersistedSyncData(syncData(0.5, [0, 0.5]), [{}, {}]),
    ).toEqual({
      syncOffset: 0.5,
      angleOffsets: [0, 0.5],
      isAnalyzed: true,
    });
  });
});
