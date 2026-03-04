import React, { useCallback, useState } from 'react';

interface UsePlaylistWindowMenuActionsParams {
  loadPlaylistFromPath: () => Promise<void>;
  loadedFilePath: string | null;
  handleSavePlaylist: (showSuccessMessage?: boolean) => Promise<void>;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistWindowMenuActions = ({
  loadPlaylistFromPath,
  loadedFilePath,
  handleSavePlaylist,
  setSaveDialogOpen,
}: UsePlaylistWindowMenuActionsParams) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLoadPlaylist = useCallback(async () => {
    handleMenuClose();
    await loadPlaylistFromPath();
  }, [handleMenuClose, loadPlaylistFromPath]);

  const handleSaveClick = useCallback(() => {
    if (loadedFilePath) {
      void handleSavePlaylist(false);
      return;
    }
    setSaveDialogOpen(true);
  }, [handleSavePlaylist, loadedFilePath, setSaveDialogOpen]);

  return {
    anchorEl,
    handleMenuOpen,
    handleMenuClose,
    handleLoadPlaylist,
    handleSaveClick,
  };
};
