import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlaylistItem } from '../../../../types/playlist/core';

interface UsePlaylistSelectionParams {
  items: PlaylistItem[];
  setItems: (updater: (prev: PlaylistItem[]) => PlaylistItem[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistSelection = ({
  items,
  setItems,
  onDirtyChange,
  currentIndex,
  setCurrentIndex,
  setIsPlaying,
}: UsePlaylistSelectionParams) => {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  const selectedCount = selectedItemIds.size;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.has(item.id)),
    [items, selectedItemIds],
  );

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setSelectedItemIds((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedItemIds.size === 0) return;
    setItems((prev) => {
      const currentItemId = prev[currentIndex]?.id;
      const next = prev.filter((item) => !selectedItemIds.has(item.id));
      if (currentItemId && !selectedItemIds.has(currentItemId)) {
        setCurrentIndex(next.findIndex((item) => item.id === currentItemId));
      } else {
        setIsPlaying(false);
        setCurrentIndex(
          next.length === 0 ? -1 : Math.min(currentIndex, next.length - 1),
        );
      }
      return next;
    });
    clearSelection();
    onDirtyChange?.(true);
  }, [
    clearSelection,
    currentIndex,
    onDirtyChange,
    selectedItemIds,
    setCurrentIndex,
    setIsPlaying,
    setItems,
  ]);

  return {
    selectedItemIds,
    selectedItems,
    selectedCount,
    toggleSelect,
    clearSelection,
    deleteSelected,
    setSelectedItemIds,
  };
};
