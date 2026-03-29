import type { Playlist } from '../../../types/Playlist';

type PlaylistLoadResult = {
  playlist: Playlist;
  filePath: string;
};

const getPlaylistApi = () => globalThis.window.electronAPI?.playlist;

export const loadPlaylistFile = async (
  filePath?: string,
): Promise<PlaylistLoadResult | null> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return null;
  }

  try {
    return await playlistApi.loadPlaylistFile(filePath);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] loadPlaylistFile failed', error);
    return null;
  }
};

export const savePlaylistFile = async (
  playlist: Playlist,
): Promise<string | null> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return null;
  }

  try {
    return await playlistApi.savePlaylistFile(playlist);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] savePlaylistFile failed', error);
    return null;
  }
};

export const savePlaylistFileAs = async (
  playlist: Playlist,
): Promise<string | null> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return null;
  }

  try {
    return await playlistApi.savePlaylistFileAs(playlist);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] savePlaylistFileAs failed', error);
    return null;
  }
};

export const subscribePlaylistExternalOpen = (
  callback: (filePath: string) => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.onExternalOpen) {
    return () => undefined;
  }

  try {
    return playlistApi.onExternalOpen(callback);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onExternalOpen failed', error);
    return () => undefined;
  }
};

export const subscribePlaylistSaveRequest = (
  callback: () => void,
): (() => void) => {
  const electronApi = globalThis.window.electronAPI;
  if (!electronApi?.onPlaylistRequestSave) {
    return () => undefined;
  }

  try {
    return electronApi.onPlaylistRequestSave(callback);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onPlaylistRequestSave failed', error);
    return () => undefined;
  }
};

export const syncPlaylistWindowTitle = (title: string): void => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.setWindowTitle) {
    return;
  }

  try {
    playlistApi.setWindowTitle(title);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] setWindowTitle failed', error);
  }
};

export const syncPlaylistDirtyState = (isDirty: boolean): void => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.sendCommand) {
    return;
  }

  try {
    playlistApi.sendCommand({
      type: 'set-dirty',
      isDirty,
    });
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] sync dirty state failed', error);
  }
};

export const notifyPlaylistSavedAndClose = (): void => {
  try {
    globalThis.window.electronAPI?.notifyPlaylistSavedAndClose?.();
  } catch (error: unknown) {
    console.debug(
      '[PlaylistWindowGateway] notifyPlaylistSavedAndClose failed',
      error,
    );
  }
};
