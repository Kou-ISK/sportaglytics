import { applyPresentationOrder } from '../../../../shared/playlist/playlistPresentationOrder';
import { useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type {
  ItemAnnotation,
  PlaylistItem,
} from '../../../../types/playlist/core';

interface UsePlaylistItemOperationsParams {
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UsePlaylistItemOperationsResult {
  handleRemoveItem: (id: string) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleReorder: (ids: string[]) => void;
}

export const usePlaylistItemOperations = ({
  currentIndex,
  setCurrentIndex,
  setIsPlaying,
  setItemsWithHistory,
  setItemAnnotations,
  setHasUnsavedChanges,
}: UsePlaylistItemOperationsParams): UsePlaylistItemOperationsResult => {
  const handleRemoveItem = useCallback(
    (id: string) => {
      setItemsWithHistory((prev) => {
        const newItems = prev.filter((item) => item.id !== id);
        const removedIndex = prev.findIndex((item) => item.id === id);
        if (removedIndex === -1) return prev;
        if (removedIndex === currentIndex) {
          setIsPlaying(false);
          setCurrentIndex(
            newItems.length === 0
              ? -1
              : Math.min(currentIndex, newItems.length - 1),
          );
        } else if (removedIndex < currentIndex) {
          setCurrentIndex(currentIndex - 1);
        }
        return newItems;
      });
      setItemAnnotations((prev) => {
        const newAnnotations = { ...prev };
        delete newAnnotations[id];
        return newAnnotations;
      });
      setHasUnsavedChanges(true);
    },
    [
      currentIndex,
      setCurrentIndex,
      setHasUnsavedChanges,
      setIsPlaying,
      setItemAnnotations,
      setItemsWithHistory,
    ],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setItemsWithHistory((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id);
        const newIndex = prev.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const newItems = applyPresentationOrder(
          prev,
          arrayMove(prev, oldIndex, newIndex).map((item) => item.id),
        );

        if (oldIndex === currentIndex) {
          setCurrentIndex(newIndex);
        } else if (oldIndex < currentIndex && newIndex >= currentIndex) {
          setCurrentIndex(currentIndex - 1);
        } else if (oldIndex > currentIndex && newIndex <= currentIndex) {
          setCurrentIndex(currentIndex + 1);
        }

        return newItems;
      });
      setHasUnsavedChanges(true);
    },
    [currentIndex, setCurrentIndex, setHasUnsavedChanges, setItemsWithHistory],
  );

  const handleReorder = useCallback(
    (ids: string[]): void => {
      setIsPlaying(false);
      setItemsWithHistory((previous) => {
        const currentId = previous[currentIndex]?.id;
        const next = applyPresentationOrder(previous, ids);
        if (currentId)
          setCurrentIndex(next.findIndex((item) => item.id === currentId));
        return next;
      });
      setHasUnsavedChanges(true);
    },
    [
      currentIndex,
      setCurrentIndex,
      setHasUnsavedChanges,
      setIsPlaying,
      setItemsWithHistory,
    ],
  );
  return { handleRemoveItem, handleDragEnd, handleReorder };
};
