import { useEffect } from 'react';
import {
  syncPlaylistDirtyState,
  syncPlaylistWindowTitle,
} from '../../gateway/playlistWindowGateway';

interface UsePlaylistWindowSyncParams {
  playlistName: string;
  isDirty: boolean;
}

export const usePlaylistWindowSync = ({
  playlistName,
  isDirty,
}: UsePlaylistWindowSyncParams): void => {
  useEffect(() => {
    syncPlaylistWindowTitle(isDirty ? `${playlistName} *` : playlistName);
  }, [isDirty, playlistName]);

  useEffect(() => {
    syncPlaylistDirtyState(isDirty);
  }, [isDirty]);
};
