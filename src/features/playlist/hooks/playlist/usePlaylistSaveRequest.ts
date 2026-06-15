import { useEffect } from 'react';
import { subscribePlaylistSaveRequest } from '../../gateway/playlistWindowGateway';

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
}: UsePlaylistSaveRequestParams): void => {
  useEffect(() => {
    const handleRequestSave = (): void => {
      if (loadedFilePath) {
        void handleSavePlaylist(true);
      } else {
        setCloseAfterSave(true);
        setSaveDialogOpen(true);
      }
    };

    return subscribePlaylistSaveRequest(handleRequestSave);
  }, [
    handleSavePlaylist,
    loadedFilePath,
    setCloseAfterSave,
    setSaveDialogOpen,
  ]);
};
