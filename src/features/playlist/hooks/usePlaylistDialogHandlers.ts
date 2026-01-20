import { useCallback } from 'react';

interface UsePlaylistDialogHandlersParams {
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCloseAfterSave: React.Dispatch<React.SetStateAction<boolean>>;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNoteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingItemId: React.Dispatch<React.SetStateAction<string | null>>;
  setExportProgress: React.Dispatch<
    React.SetStateAction<{ current: number; total: number; message: string } | null>
  >;
}

interface UsePlaylistDialogHandlersResult {
  handleCloseSaveDialog: () => void;
  handleCloseExportDialog: () => void;
  handleCloseNoteDialog: () => void;
  handleCloseExportProgress: () => void;
}

export const usePlaylistDialogHandlers = ({
  setSaveDialogOpen,
  setCloseAfterSave,
  setExportDialogOpen,
  setNoteDialogOpen,
  setEditingItemId,
  setExportProgress,
}: UsePlaylistDialogHandlersParams): UsePlaylistDialogHandlersResult => {
  const handleCloseSaveDialog = useCallback(() => {
    setSaveDialogOpen(false);
    setCloseAfterSave(false);
  }, [setCloseAfterSave, setSaveDialogOpen]);

  const handleCloseExportDialog = useCallback(() => {
    setExportDialogOpen(false);
  }, [setExportDialogOpen]);

  const handleCloseNoteDialog = useCallback(() => {
    setNoteDialogOpen(false);
    setEditingItemId(null);
  }, [setEditingItemId, setNoteDialogOpen]);

  const handleCloseExportProgress = useCallback(() => {
    setExportProgress(null);
  }, [setExportProgress]);

  return {
    handleCloseSaveDialog,
    handleCloseExportDialog,
    handleCloseNoteDialog,
    handleCloseExportProgress,
  };
};
