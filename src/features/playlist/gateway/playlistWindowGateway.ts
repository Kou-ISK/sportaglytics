import type {
  PlaylistFileLoadResult,
  Playlist,
  PlaylistCommand,
  PlaylistItem,
  PlaylistSaveProgressPayload,
  PlaylistSyncData,
} from '../../../types/Playlist';

const getPlaylistApi = () => globalThis.window.electronAPI?.playlist;
const noop = (): void => undefined;

const waitFor = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
};

export const loadPlaylistFile = async (
  filePath?: string,
): Promise<PlaylistFileLoadResult | null> => {
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

export const getPlaylistOpenWindowCount = async (): Promise<number> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return 0;
  }

  try {
    return await playlistApi.getOpenWindowCount();
  } catch (error: unknown) {
    console.debug(
      '[PlaylistWindowGateway] getOpenWindowCount failed',
      error,
    );
    return 0;
  }
};

export const openPlaylistWindow = async (): Promise<boolean> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return false;
  }

  try {
    await playlistApi.openWindow();
    return true;
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] openWindow failed', error);
    return false;
  }
};

export const ensurePlaylistWindowOpen = async (): Promise<boolean> => {
  const count = await getPlaylistOpenWindowCount();
  if (count > 0) {
    return true;
  }

  const opened = await openPlaylistWindow();
  if (!opened) {
    return false;
  }

  await waitFor(500);
  return true;
};

export const isPlaylistWindowOpen = async (): Promise<boolean> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return false;
  }

  try {
    return await playlistApi.isWindowOpen();
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] isWindowOpen failed', error);
    return false;
  }
};

export const syncPlaylistWindow = (data: PlaylistSyncData): void => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return;
  }

  try {
    playlistApi.syncToWindow(data);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] syncToWindow failed', error);
  }
};

export const addPlaylistItemToAllWindows = async (
  item: PlaylistItem,
): Promise<boolean> => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return false;
  }

  try {
    await playlistApi.addItemToAllWindows(item);
    return true;
  } catch (error: unknown) {
    console.debug(
      '[PlaylistWindowGateway] addItemToAllWindows failed',
      error,
    );
    return false;
  }
};

export const subscribePlaylistCommand = (
  callback: (command: PlaylistCommand) => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return noop;
  }

  try {
    playlistApi.onCommand(callback);
    return () => {
      try {
        playlistApi.offCommand(callback);
      } catch (error: unknown) {
        console.debug('[PlaylistWindowGateway] offCommand failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onCommand failed', error);
    return noop;
  }
};

export const subscribePlaylistSync = (
  callback: (data: PlaylistSyncData) => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return noop;
  }

  try {
    playlistApi.onSync(callback);
    return () => {
      try {
        playlistApi.offSync(callback);
      } catch (error: unknown) {
        console.debug('[PlaylistWindowGateway] offSync failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onSync failed', error);
    return noop;
  }
};

export const subscribePlaylistSaveProgress = (
  callback: (data: PlaylistSaveProgressPayload) => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.onSaveProgress) {
    return noop;
  }

  try {
    return playlistApi.onSaveProgress(callback);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onSaveProgress failed', error);
    return noop;
  }
};

export const subscribePlaylistAddItem = (
  callback: (item: PlaylistItem) => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return noop;
  }

  try {
    playlistApi.onAddItem(callback);
    return () => {
      try {
        playlistApi.offAddItem(callback);
      } catch (error: unknown) {
        console.debug('[PlaylistWindowGateway] offAddItem failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onAddItem failed', error);
    return noop;
  }
};

export const requestPlaylistSync = (): void => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.sendCommand) {
    return;
  }

  try {
    playlistApi.sendCommand({ type: 'request-sync' });
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] request-sync failed', error);
  }
};

export const subscribePlaylistWindowClosed = (
  callback: () => void,
): (() => void) => {
  const playlistApi = getPlaylistApi();
  if (!playlistApi) {
    return noop;
  }

  try {
    playlistApi.onWindowClosed(callback);
    return () => {
      try {
        playlistApi.offWindowClosed(callback);
      } catch (error: unknown) {
        console.debug(
          '[PlaylistWindowGateway] offWindowClosed failed',
          error,
        );
      }
    };
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onWindowClosed failed', error);
    return noop;
  }
};

export const observePlaylistWindowState = (
  callback: (isOpen: boolean) => void,
  intervalMs = 2000,
): (() => void) => {
  let disposed = false;

  const syncState = async (): Promise<void> => {
    const isOpen = await isPlaylistWindowOpen();
    if (!disposed) {
      callback(isOpen);
    }
  };

  void syncState();

  const intervalId = globalThis.setInterval(() => {
    void syncState();
  }, intervalMs);

  return () => {
    disposed = true;
    globalThis.clearInterval(intervalId);
  };
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
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.onRequestSave) {
    return () => undefined;
  }

  try {
    return playlistApi.onRequestSave(callback);
  } catch (error: unknown) {
    console.debug('[PlaylistWindowGateway] onRequestSave failed', error);
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
  const playlistApi = getPlaylistApi();
  if (!playlistApi?.notifySavedAndClose) {
    return;
  }

  try {
    playlistApi.notifySavedAndClose();
  } catch (error: unknown) {
    console.debug(
      '[PlaylistWindowGateway] notifyPlaylistSavedAndClose failed',
      error,
    );
  }
};
