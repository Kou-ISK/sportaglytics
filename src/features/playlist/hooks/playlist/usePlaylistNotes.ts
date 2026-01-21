import { useCallback, useState } from 'react';
import type { PlaylistItem } from '../../../../types/Playlist';

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

  const handleSaveNote = useCallback(
    (note: string) => {
      if (!editingItemId) return;
      setItemsWithHistory((prev) =>
        prev.map((item) =>
          item.id === editingItemId ? { ...item, note } : item,
        ),
      );
      setNoteDialogOpen(false);
      setEditingItemId(null);
      setHasUnsavedChanges(true);
    },
    [editingItemId, setHasUnsavedChanges, setItemsWithHistory],
  );

  return {
    editingItemId,
    noteDialogOpen,
    setNoteDialogOpen,
    setEditingItemId,
    handleEditNote,
    handleSaveNote,
  };
};
