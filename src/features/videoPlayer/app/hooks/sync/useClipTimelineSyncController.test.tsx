// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useClipTimelineSyncController } from './useClipTimelineSyncController';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
const { getTime } = vi.hoisted(() => ({
  getTime: vi.fn((id: string) => (id === 'sync_reference_clip' ? 3 : 1)),
}));
vi.mock('../../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayerCurrentTime: getTime,
}));
vi.mock('./useClipSyncAudio', () => ({
  useClipSyncAudio: () => ({ analyze: vi.fn(), cancel: vi.fn() }),
}));
const angles: PackageMediaAngle[] = [0, 1].map((angle) => ({
  id: `angle${angle}`,
  name: `Angle ${angle + 1}`,
  sourceKind: 'local',
  clips: [0, 1].map((clip) => ({
    id: `${angle}-${clip}`,
    sourceKind: 'local',
    source: `videos/${angle}-${clip}.mp4`,
    gapBeforeSeconds: 0,
    timelineStartSeconds: clip * 6,
    durationSeconds: 6,
  })),
}));
const setup = () => {
  const onCancel = vi.fn();
  const setMediaAngles = vi.fn();
  const hook = renderHook(() =>
    useClipTimelineSyncController({
      mediaAngles: angles,
      onApplySync: vi.fn(),
      onCancel,
      setMediaAngles,
      setVideoList: vi.fn(),
      metaDataConfigFilePath: 'sample.stpkg/.metadata/config.json',
    }),
  );
  return { ...hook, onCancel, setMediaAngles };
};
describe('clip alignment drafts', () => {
  it('starts with different angles and retains draft positions when source metadata arrives', () => {
    const { result, setMediaAngles } = setup();
    expect(result.current.referenceId).toBe('0-0');
    expect(result.current.targetId).toBe('1-0');
    act(() => result.current.placeAtCurrentPositions());
    expect(result.current.placements['1-0']).toBe(2);
    act(() => result.current.recordClipDuration('1-0')(6.03));
    expect(result.current.placements['1-0']).toBe(2);
    expect(result.current.target?.durationSeconds).toBe(6.03);
    expect(setMediaAngles).not.toHaveBeenCalled();
  });
  it('keeps the first pair when selecting and aligning the second pair, then discards on cancel', () => {
    const { result, onCancel, setMediaAngles } = setup();
    act(() => result.current.placeAtCurrentPositions());
    act(() => {
      result.current.setReferenceId('0-1');
      result.current.setTargetId('1-1');
    });
    act(() => result.current.placeAtCurrentPositions());
    expect(result.current.placements).toEqual({ '1-0': 2, '1-1': 8 });
    act(() => result.current.cancel());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(setMediaAngles).not.toHaveBeenCalled();
  });
});
