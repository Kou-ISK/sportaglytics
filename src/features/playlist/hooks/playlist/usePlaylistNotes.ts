import { useCallback, useState } from 'react';
import type { PlaylistItem } from '../../../../types/playlist/core';

interface UsePlaylistNotesParams {
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UsePlaylistNotesResult {
  editingItemId: string | null;
  noteDialogOpen: boolean;
  setNoteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingItemId: React.Dispatch<React.SetStateAction<string | null>>;
  handleEditNote: (itemId: string) => void;
  handleSaveNote: (note: string) => void;
  updateNote: (itemId: string, note: string) => void;
}

export const usePlaylistNotes = ({
  setItemsWithHistory,
  setHasUnsavedChanges,
}: UsePlaylistNotesParams): UsePlaylistNotesResult => {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleEditNote = useCallback((itemId: string) => {
    setEditingItemId(itemId);
    setNoteDialogOpen(true);
  }, []);

  const updateNote = useCallback(
    (itemId: string, note: string): void => {
      setItemsWithHistory((previous) => {
        const current = previous.find((item) => item.id === itemId);
        if (!current || (current.note ?? '') === note) return previous;
        return previous.map((item) =>
          item.id === itemId ? { ...item, note } : item,
        );
      });
      setHasUnsavedChanges(true);
    },
    [setItemsWithHistory, setHasUnsavedChanges],
  );

  const handleSaveNote = useCallback(
    (note: string): void => {
      if (!editingItemId) return;
      updateNote(editingItemId, note);
      setNoteDialogOpen(false);
      setEditingItemId(null);
    },
    [editingItemId, updateNote],
  );

  return {
    editingItemId,
    noteDialogOpen,
    setNoteDialogOpen,
    setEditingItemId,
    handleEditNote,
    updateNote,
    handleSaveNote,
  };
};
