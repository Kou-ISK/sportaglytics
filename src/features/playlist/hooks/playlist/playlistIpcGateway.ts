import type {
  IPlaylistAPI,
  PlaylistItem,
  PlaylistSyncData,
} from '../../../../types/Playlist';

interface PlaylistIpcHandlers {
  onSync: (data: PlaylistSyncData) => void;
  onSaveProgress: (data: { current: number; total: number }) => void;
  onAddItem: (item: PlaylistItem) => void;
}

export const registerPlaylistIpcHandlers = (
  playlistApi: IPlaylistAPI,
  handlers: PlaylistIpcHandlers,
): (() => void) => {
  let unsubscribeSaveProgress: (() => void) | null = null;

  try {
    playlistApi.onSync(handlers.onSync);
    unsubscribeSaveProgress = playlistApi.onSaveProgress(
      handlers.onSaveProgress,
    );
    playlistApi.onAddItem(handlers.onAddItem);
    playlistApi.sendCommand({ type: 'request-sync' });
  } catch (error: unknown) {
    playlistApi.offSync(handlers.onSync);
    playlistApi.offAddItem(handlers.onAddItem);
    unsubscribeSaveProgress?.();
    throw error;
  }

  return () => {
    playlistApi.offSync(handlers.onSync);
    playlistApi.offAddItem(handlers.onAddItem);
    unsubscribeSaveProgress?.();
  };
};
