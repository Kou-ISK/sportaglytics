import { useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ItemAnnotation, PlaylistItem } from '../../../types/Playlist';

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
        if (removedIndex <= currentIndex && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        } else if (removedIndex === currentIndex) {
          setIsPlaying(false);
          if (newItems.length === 0) {
            setCurrentIndex(-1);
          }
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
        const newItems = arrayMove(prev, oldIndex, newIndex);

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

  return { handleRemoveItem, handleDragEnd };
};
