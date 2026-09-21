import { useCallback, useEffect } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
} from '../../../../types/playlist/core';

interface UsePlaylistHistorySyncParams {
  undo: () => PlaylistItem[] | null;
  redo: () => PlaylistItem[] | null;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  items: PlaylistItem[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  onDirtyChange: (dirty: boolean) => void;
}

interface UsePlaylistHistorySyncResult {
  handleUndo: () => void;
  handleRedo: () => void;
}

export const usePlaylistHistorySync = ({
  undo,
  redo,
  setItemAnnotations,
  items,
  currentIndex,
  setCurrentIndex,
  canUndo,
  canRedo,
  onDirtyChange,
}: UsePlaylistHistorySyncParams): UsePlaylistHistorySyncResult => {
  const rebuildAnnotations = useCallback(
    (items: PlaylistItem[]) => {
      const annotations: Record<string, ItemAnnotation> = {};
      for (const item of items) {
        if (item.annotation) {
          annotations[item.id] = item.annotation;
        }
      }
      setItemAnnotations(annotations);
    },
    [setItemAnnotations],
  );

  useEffect(() => {
    rebuildAnnotations(items);
  }, [items, rebuildAnnotations]);

  const preserveCurrentItem = useCallback(
    (restored: PlaylistItem[] | null): void => {
      if (!restored) return;
      const id = items[currentIndex]?.id;
      if (id) setCurrentIndex(restored.findIndex((item) => item.id === id));
    },
    [items, currentIndex, setCurrentIndex],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    preserveCurrentItem(undo());
    onDirtyChange(true);
  }, [canUndo, onDirtyChange, undo, preserveCurrentItem]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    preserveCurrentItem(redo());
    onDirtyChange(true);
  }, [canRedo, onDirtyChange, redo, preserveCurrentItem]);

  return { handleUndo, handleRedo };
};
