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
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(
    null,
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

  const selectWithModifiers = useCallback(
    (
      id: string,
      modifiers: { additive: boolean; range: boolean },
      visibleIds?: string[],
    ): void => {
      const itemIndex = items.findIndex((item) => item.id === id);
      if (itemIndex < 0) return;
      setCurrentIndex(itemIndex);
      setIsPlaying(false);
      setSelectedItemIds((previous) => {
        if (modifiers.range && selectionAnchorId) {
          const validIds = new Set(items.map((item) => item.id));
          const orderedIds =
            visibleIds?.filter((id) => validIds.has(id)) ??
            items.map((item) => item.id);
          const visibleIndex = orderedIds.indexOf(id);
          const anchorIndex = orderedIds.indexOf(selectionAnchorId);
          if (anchorIndex >= 0 && visibleIndex >= 0) {
            const start = Math.min(anchorIndex, visibleIndex);
            const end = Math.max(anchorIndex, visibleIndex);
            const next = modifiers.additive
              ? new Set(previous)
              : new Set<string>();
            for (let index = start; index <= end; index += 1) {
              const rangeId = orderedIds[index];
              if (rangeId) next.add(rangeId);
            }
            return next;
          }
        }
        if (modifiers.additive) {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        return new Set([id]);
      });
      setSelectionAnchorId(id);
    },
    [items, selectionAnchorId, setCurrentIndex, setIsPlaying],
  );

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
    setSelectionAnchorId(null);
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
    selectWithModifiers,
  };
};
