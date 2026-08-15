// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { usePlaylistSelection } from './usePlaylistSelection';

const makeItem = (id: string): PlaylistItem => ({
  id,
  timelineItemId: `timeline-${id}`,
  actionName: 'Goal',
  startTime: 1,
  endTime: 2,
  addedAt: 1,
});

describe('usePlaylistSelection', () => {
  it('preserves the playing item by id when earlier selected items are deleted', () => {
    let items = [makeItem('a'), makeItem('b'), makeItem('c')];
    let currentIndex = 2;
    const setIsPlaying = vi.fn();
    const setCurrentIndex = vi.fn((value: React.SetStateAction<number>) => {
      currentIndex = typeof value === 'function' ? value(currentIndex) : value;
    });
    const setItems = (
      update: (previous: PlaylistItem[]) => PlaylistItem[],
    ): void => {
      items = update(items);
    };

    const { result } = renderHook(() =>
      usePlaylistSelection({
        items,
        setItems,
        currentIndex,
        setCurrentIndex,
        setIsPlaying,
        onDirtyChange: vi.fn(),
      }),
    );

    act(() => result.current.toggleSelect('a'));
    act(() => result.current.deleteSelected());

    expect(items.map((item) => item.id)).toEqual(['b', 'c']);
    expect(currentIndex).toBe(1);
    expect(setIsPlaying).not.toHaveBeenCalled();
  });

  it('stops playback and chooses a valid neighbor when the current item is deleted', () => {
    let items = [makeItem('a'), makeItem('b')];
    let currentIndex = 1;
    const setIsPlaying = vi.fn();
    const setCurrentIndex = vi.fn((value: React.SetStateAction<number>) => {
      currentIndex = typeof value === 'function' ? value(currentIndex) : value;
    });
    const { result } = renderHook(() =>
      usePlaylistSelection({
        items,
        setItems: (update) => {
          items = update(items);
        },
        currentIndex,
        setCurrentIndex,
        setIsPlaying,
      }),
    );

    act(() => result.current.toggleSelect('b'));
    act(() => result.current.deleteSelected());

    expect(currentIndex).toBe(0);
    expect(setIsPlaying).toHaveBeenCalledWith(false);
  });
});
