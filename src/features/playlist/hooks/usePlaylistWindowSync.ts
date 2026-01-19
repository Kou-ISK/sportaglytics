import { useEffect } from 'react';

interface UsePlaylistWindowSyncParams {
  playlistName: string;
  loadedFilePath: string | null;
  isDirty: boolean;
}

export const usePlaylistWindowSync = ({
  playlistName,
  loadedFilePath,
  isDirty,
}: UsePlaylistWindowSyncParams) => {
  useEffect(() => {
    const title = isDirty
      ? `${playlistName} *`
      : loadedFilePath
        ? playlistName
        : playlistName;
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI?.setWindowTitle) {
      console.debug('[PlaylistWindow] playlist API unavailable for title sync');
      return;
    }
    try {
      playlistAPI.setWindowTitle(title);
    } catch (error: unknown) {
      console.debug('[PlaylistWindow] Failed to update window title', error);
    }
  }, [isDirty, playlistName, loadedFilePath]);

  useEffect(() => {
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI?.sendCommand) {
      console.debug('[PlaylistWindow] playlist API unavailable for dirty sync');
      return;
    }
    try {
      playlistAPI.sendCommand({
        type: 'set-dirty',
        isDirty,
      });
    } catch (error: unknown) {
      console.debug('[PlaylistWindow] Failed to sync dirty state', error);
    }
  }, [isDirty]);
};
