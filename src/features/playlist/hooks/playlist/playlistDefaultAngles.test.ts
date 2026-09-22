// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { usePlaylistHistory } from './usePlaylistHistory';
import { usePlaylistInstanceAngles } from './usePlaylistInstanceAngles';

const initial: PlaylistItem[] = [
  {
    id: 'one',
    timelineItemId: null,
    actionName: 'Review',
    addedAt: 1,
    startTime: 0,
    endTime: 4,
    videoSource: '/old/sample.stpkg/one.mp4',
  },
];

it('applies the saved angle on clip entry, without overriding temporary preview changes on unrelated renders', () => {
  const setViewMode = vi.fn();
  const setDirty = vi.fn();
  const { rerender } = renderHook(
    ({ currentItem }) =>
      usePlaylistInstanceAngles({
        currentItem,
        setItems: vi.fn(),
        setViewMode,
        setDirty,
      }),
    { initialProps: { currentItem: initial[0] } },
  );
  expect(setViewMode).toHaveBeenLastCalledWith('angle1');
  rerender({ currentItem: { ...initial[0], note: 'Edited' } });
  expect(setViewMode).toHaveBeenCalledTimes(1);
  rerender({
    currentItem: { ...initial[0], id: 'two', defaultAngle: 'angle2' },
  });
  expect(setViewMode).toHaveBeenLastCalledWith('angle2');
  expect(setDirty).not.toHaveBeenCalled();
});

it('undoes angle edits without undoing a repaired media reference', () => {
  const setViewMode = vi.fn();
  const setDirty = vi.fn();
  const { result } = renderHook(() => {
    const history = usePlaylistHistory(initial);
    const angles = usePlaylistInstanceAngles({
      currentItem: history.items[0],
      setItems: history.setItems,
      setViewMode,
      setDirty,
    });
    return { ...history, ...angles };
  });
  act(() => result.current.setDefaultAngle('one', 'angle2'));
  expect(setViewMode).toHaveBeenLastCalledWith('angle2');
  act(() =>
    result.current.reconcileMedia(initial, [
      { ...initial[0], videoSource: '/new/sample.stpkg/one.mp4' },
    ]),
  );
  act(() => {
    result.current.undo();
  });
  expect(result.current.items[0].defaultAngle).toBeUndefined();
  expect(result.current.items[0].videoSource).toContain('/new/');
  act(() => {
    result.current.redo();
  });
  expect(result.current.items[0].defaultAngle).toBe('angle2');
  expect(result.current.items[0].videoSource).toContain('/new/');
});
