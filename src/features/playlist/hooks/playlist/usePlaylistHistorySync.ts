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

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
    onDirtyChange(true);
  }, [canUndo, onDirtyChange, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
    onDirtyChange(true);
  }, [canRedo, onDirtyChange, redo]);

  return { handleUndo, handleRedo };
};
