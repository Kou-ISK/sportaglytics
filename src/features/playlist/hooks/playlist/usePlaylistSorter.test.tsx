// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { usePlaylistHistory } from './usePlaylistHistory';
import { usePlaylistSorter } from './usePlaylistSorter';
import { sorterFixture } from '../../fixtures/sorter';
import { applyPresentationOrder } from '../../../../shared/playlist/playlistPresentationOrder';
import { usePlaylistItemOperations } from './usePlaylistItemOperations';
import { usePlaylistHistorySync } from './usePlaylistHistorySync';
import type { ItemAnnotation } from '../../../../types/playlist/core';

it('sorts the document once, filters without reordering, and supports immediate Undo/Redo', () => {
  const onSelectItem = vi.fn();
  const { result } = renderHook(() => {
    const history = usePlaylistHistory(sorterFixture);
    const sorter = usePlaylistSorter({
      items: history.items,
      currentIndex: 0,
      selectedItemIds: new Set(),
      onSelectItem,
      onPlayItem: vi.fn(),
      onDeleteSelected: vi.fn(),
      onUpdateNote: vi.fn(),
      onReorder: (ids) =>
        history.setItems((items) => applyPresentationOrder(items, ids)),
    });
    return { history, sorter };
  });
  act(() => result.current.sorter.onSort('duration', 'asc'));
  expect(result.current.history.items.map((item) => item.id)).toEqual([
    'b',
    'c',
    'a',
  ]);
  act(() => result.current.sorter.onQueryChange('Keep'));
  expect(result.current.sorter.items.map((item) => item.id)).toEqual([
    'c',
    'a',
  ]);
  act(() =>
    result.current.sorter.onSelectItem('a', { additive: false, range: true }),
  );
  expect(onSelectItem).toHaveBeenLastCalledWith(
    'a',
    { additive: false, range: true },
    ['c', 'a'],
  );
  act(() => {
    const undo = result.current.history.undo();
    expect(undo?.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    const redo = result.current.history.redo();
    expect(redo?.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });
  act(() => result.current.history.undo());
  expect(result.current.history.items).toEqual(sorterFixture);
  expect(result.current.history.canUndo).toBe(false);
});

it('keeps the current clip by ID through a real sort command and history restoration', () => {
  const { result } = renderHook(() => {
    const history = usePlaylistHistory(sorterFixture);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [dirty, setHasUnsavedChanges] = useState(false);
    const [, setItemAnnotations] = useState<Record<string, ItemAnnotation>>({});
    const operations = usePlaylistItemOperations({
      currentIndex,
      setCurrentIndex,
      setIsPlaying,
      setItemsWithHistory: history.setItems,
      setHasUnsavedChanges,
      setItemAnnotations,
    });
    const commands = usePlaylistHistorySync({
      ...history,
      currentIndex,
      setCurrentIndex,
      setItemAnnotations,
      onDirtyChange: setHasUnsavedChanges,
    });
    return {
      history,
      operations,
      commands,
      currentId: history.items[currentIndex]?.id,
      isPlaying,
      dirty,
    };
  });
  act(() => result.current.operations.handleReorder(['b', 'c', 'a']));
  expect(result.current.currentId).toBe('a');
  expect(result.current.isPlaying).toBe(false);
  expect(result.current.dirty).toBe(true);
  act(() => result.current.commands.handleUndo());
  expect(result.current.currentId).toBe('a');
  expect(result.current.history.items).toEqual(sorterFixture);
  act(() => result.current.commands.handleRedo());
  expect(result.current.currentId).toBe('a');
  expect(result.current.history.items.map((item) => item.id)).toEqual([
    'b',
    'c',
    'a',
  ]);
});
