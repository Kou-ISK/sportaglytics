import { useEffect } from 'react';

interface UsePlaylistSaveRequestParams {
  loadedFilePath: string | null;
  handleSavePlaylist: (shouldCloseAfterSave?: boolean) => Promise<void>;
  setCloseAfterSave: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistSaveRequest = ({
  loadedFilePath,
  handleSavePlaylist,
  setCloseAfterSave,
  setSaveDialogOpen,
}: UsePlaylistSaveRequestParams) => {
  useEffect(() => {
    const handleRequestSave = () => {
      if (loadedFilePath) {
        void handleSavePlaylist(true);
      } else {
        setCloseAfterSave(true);
        setSaveDialogOpen(true);
      }
    };

    const electronAPI = window.electronAPI;
    if (!electronAPI?.on || !electronAPI?.off) {
      console.debug(
        '[PlaylistWindow] electron API unavailable for save request',
      );
      return;
    }

    try {
      electronAPI.on('playlist:request-save', handleRequestSave);
    } catch (error: unknown) {
      console.debug(
        '[PlaylistWindow] Failed to register save request handler',
        error,
      );
      return;
    }

    return () => {
      try {
        electronAPI.off('playlist:request-save', handleRequestSave);
      } catch (error: unknown) {
        console.debug(
          '[PlaylistWindow] Failed to cleanup save request handler',
          error,
        );
      }
    };
  }, [
    handleSavePlaylist,
    loadedFilePath,
    setCloseAfterSave,
    setSaveDialogOpen,
  ]);
};
