import { useCallback } from 'react';
import type { ItemAnnotation, PlaylistItem } from '../../../types/Playlist';

interface UsePlaylistHistorySyncParams {
  undo: () => PlaylistItem[] | null;
  redo: () => PlaylistItem[] | null;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
}

interface UsePlaylistHistorySyncResult {
  handleUndo: () => void;
  handleRedo: () => void;
}

export const usePlaylistHistorySync = ({
  undo,
  redo,
  setItemAnnotations,
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

  const handleUndo = useCallback(() => {
    const prevItems = undo();
    if (prevItems) {
      rebuildAnnotations(prevItems);
    }
  }, [rebuildAnnotations, undo]);

  const handleRedo = useCallback(() => {
    const nextItems = redo();
    if (nextItems) {
      rebuildAnnotations(nextItems);
    }
  }, [rebuildAnnotations, redo]);

  return { handleUndo, handleRedo };
};
