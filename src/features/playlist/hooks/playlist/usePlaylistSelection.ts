import { useCallback, useMemo, useState } from 'react';
import type { PlaylistItem } from '../../../../types/Playlist';

interface UsePlaylistSelectionParams {
  items: PlaylistItem[];
  setItems: (updater: (prev: PlaylistItem[]) => PlaylistItem[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const usePlaylistSelection = ({
  items,
  setItems,
  onDirtyChange,
}: UsePlaylistSelectionParams) => {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  const selectedCount = selectedItemIds.size;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.has(item.id)),
    [items, selectedItemIds],
  );

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
    setItems((prev) =>
      prev.filter((item) => !selectedItemIds.has(item.id)),
    );
    clearSelection();
    onDirtyChange?.(true);
  }, [clearSelection, onDirtyChange, selectedItemIds, setItems]);

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
