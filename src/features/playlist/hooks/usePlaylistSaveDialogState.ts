import { useState } from 'react';

interface UsePlaylistSaveDialogStateResult {
  saveDialogOpen: boolean;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeAfterSave: boolean;
  setCloseAfterSave: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistSaveDialogState =
  (): UsePlaylistSaveDialogStateResult => {
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [closeAfterSave, setCloseAfterSave] = useState(false);

    return {
      saveDialogOpen,
      setSaveDialogOpen,
      closeAfterSave,
      setCloseAfterSave,
    };
  };
