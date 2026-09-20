// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAngleSyncDraft } from './useAngleSyncDraft';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
vi.mock('./useClipSyncAudio', () => ({
  useClipSyncAudio: () => ({ analyze: vi.fn(), cancel: vi.fn() }),
}));
const angles: PackageMediaAngle[] = [0, 1].map((angle) => ({
  id: `angle${angle}`,
  name: `Angle ${angle + 1}`,
  sourceKind: 'local',
  clips: [0, 1].map((clip) => ({
    id: `${angle}-${clip}`,
    source: `videos/${angle}-${clip}.mp4`,
    sourceKind: 'local',
    timelineStartSeconds: clip * 6,
    gapBeforeSeconds: 0,
    durationSeconds: 6,
  })),
}));
describe('angle synchronization drafts', () => {
  it('keeps earlier alignment through metadata updates and a later period, without persisting on cancel', () => {
    const onCancel = vi.fn();
    const setMediaAngles = vi.fn();
    const { result } = renderHook(() =>
      useAngleSyncDraft({
        mediaAngles: angles,
        initialTime: 0,
        metaDataConfigFilePath: 'sample.stpkg/.metadata/config.json',
        setMediaAngles,
        setVideoList: vi.fn(),
        setSyncData: vi.fn(),
        onCancel,
        onApplySync: vi.fn(),
      }),
    );
    act(() => {
      result.current.mark(0, { clipId: '0-0', sourceTime: 2 });
      result.current.mark(1, { clipId: '1-0', sourceTime: 1 });
    });
    act(() => {
      result.current.align();
    });
    act(() => {
      result.current.recordDuration(1, '1-1', 6.03);
    });
    expect(
      result.current.draft.angles[1].clips.map(
        (clip) => clip.timelineStartSeconds,
      ),
    ).toEqual([1, 7]);
    expect(result.current.points).toEqual({});
    act(() => {
      result.current.mark(0, { clipId: '0-1', sourceTime: 3 });
      result.current.mark(1, { clipId: '1-1', sourceTime: 1 });
    });
    act(() => {
      result.current.align();
    });
    expect(
      result.current.draft.angles[1].clips.map(
        (clip) => clip.timelineStartSeconds,
      ),
    ).toEqual([1, 8]);
    act(() => {
      result.current.cancel();
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(setMediaAngles).not.toHaveBeenCalled();
  });
});
