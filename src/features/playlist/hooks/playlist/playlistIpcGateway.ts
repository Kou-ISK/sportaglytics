import type {
  PlaylistItem,
  PlaylistSaveProgressPayload,
  PlaylistSyncData,
} from '../../../../types/Playlist';
import {
  requestPlaylistSync,
  subscribePlaylistAddItem,
  subscribePlaylistSaveProgress,
  subscribePlaylistSync,
} from '../../gateway/playlistWindowGateway';

interface PlaylistIpcHandlers {
  onSync: (data: PlaylistSyncData) => void;
  onSaveProgress: (data: PlaylistSaveProgressPayload) => void;
  onAddItem: (item: PlaylistItem) => void;
}

export const registerPlaylistIpcHandlers = (
  handlers: PlaylistIpcHandlers,
): (() => void) => {
  let unsubscribeSync: (() => void) | null = null;
  let unsubscribeSaveProgress: (() => void) | null = null;
  let unsubscribeAddItem: (() => void) | null = null;

  try {
    unsubscribeSync = subscribePlaylistSync(handlers.onSync);
    unsubscribeSaveProgress = subscribePlaylistSaveProgress(
      handlers.onSaveProgress,
    );
    unsubscribeAddItem = subscribePlaylistAddItem(handlers.onAddItem);
    requestPlaylistSync();
  } catch (error: unknown) {
    unsubscribeSync?.();
    unsubscribeAddItem?.();
    unsubscribeSaveProgress?.();
    throw error;
  }

  return () => {
    unsubscribeSync?.();
    unsubscribeAddItem?.();
    unsubscribeSaveProgress?.();
  };
};
