import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import type {
  Playlist,
  PlaylistFileLoadResult,
  PlaylistItem,
  PlaylistSaveProgressPayload,
} from '../../../src/types/playlist/core';
import type {
  PlaylistCommand,
  PlaylistSyncData,
} from '../../../src/types/playlist/window';
import {
  PLAYLIST_WINDOW_CHANNELS,
  isPlaylist,
  isPlaylistCommand,
  isPlaylistFileLoadResult,
  isPlaylistItem,
  isPlaylistSaveProgressPayload,
  isPlaylistSyncData,
} from '../../../src/types/ipc/playlistWindow';
import {
  getMappedListener,
  removeMappedListener,
  setMappedListener,
  type ListenerStore,
} from './listenerStore';

type PlaylistBridgeKeys = 'playlist';

export const createPlaylistBridge = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): Pick<IElectronAPI, PlaylistBridgeKeys> => {
  const playlistBridge = {
    playlist: {
      openWindow: async () => {
        await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.openWindow);
      },
      closeWindow: async () => {
        await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.closeWindow);
      },
      isWindowOpen: async (): Promise<boolean> => {
        return await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.isWindowOpen);
      },
      syncToWindow: (data: PlaylistSyncData) => {
        if (!isPlaylistSyncData(data)) {
          console.warn('Invalid playlist sync payload rejected in preload');
          return;
        }
        ipcRenderer.send(PLAYLIST_WINDOW_CHANNELS.syncToWindow, data);
      },
      onCommand: (callback: (command: PlaylistCommand) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, command] = rawArgs as [IpcRendererEvent, PlaylistCommand];
          if (!isPlaylistCommand(command)) {
            console.warn('Invalid playlist command received in preload');
            return;
          }
          callback(command);
        };
        setMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.command,
          callback,
          wrapped,
        );
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.command, wrapped);
      },
      offCommand: (callback: (command: PlaylistCommand) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.command,
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.command, wrapped);
        removeMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.command,
          callback,
        );
      },
      onWindowClosed: (callback: () => void) => {
        const wrapped = () => callback();
        setMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.windowClosed,
          callback,
          wrapped,
        );
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.windowClosed, wrapped);
      },
      offWindowClosed: (callback: () => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.windowClosed,
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.windowClosed, wrapped);
        removeMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.windowClosed,
          callback,
        );
      },
      onSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, data] = rawArgs as [IpcRendererEvent, PlaylistSyncData];
          if (!isPlaylistSyncData(data)) {
            console.warn('Invalid playlist sync payload received in preload');
            return;
          }
          callback(data);
        };
        setMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.sync,
          callback,
          wrapped,
        );
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.sync, wrapped);
      },
      offSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.sync,
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.sync, wrapped);
        removeMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.sync,
          callback,
        );
      },
      sendCommand: (command: PlaylistCommand) => {
        if (!isPlaylistCommand(command)) {
          console.warn('Invalid playlist command rejected in preload');
          return;
        }
        ipcRenderer.send(PLAYLIST_WINDOW_CHANNELS.command, command);
      },
      savePlaylistFile: async (playlist: Playlist): Promise<string | null> => {
        if (!isPlaylist(playlist)) {
          console.warn('Invalid playlist payload rejected in preload');
          return null;
        }
        return await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.saveFile, playlist);
      },
      savePlaylistFileAs: async (playlist: Playlist): Promise<string | null> => {
        if (!isPlaylist(playlist)) {
          console.warn('Invalid playlist payload rejected in preload');
          return null;
        }
        return await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.saveFileAs, playlist);
      },
      loadPlaylistFile: async (
        filePath?: string,
      ): Promise<PlaylistFileLoadResult | null> => {
        const result = await ipcRenderer.invoke(
          PLAYLIST_WINDOW_CHANNELS.loadFile,
          filePath,
        );
        return isPlaylistFileLoadResult(result) ? result : null;
      },
      onExternalOpen: (callback: (filePath: string) => void) => {
        const wrapped = (_: unknown, path: string) => callback(path);
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.externalOpen, wrapped);
        return () =>
          ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.externalOpen, wrapped);
      },
      onSaveProgress: (
        callback: (data: PlaylistSaveProgressPayload) => void,
      ) => {
        const wrapped = (_: unknown, data: PlaylistSaveProgressPayload) => {
          if (!isPlaylistSaveProgressPayload(data)) {
            console.warn('Invalid playlist save progress payload received in preload');
            return;
          }
          callback(data);
        };
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.saveProgress, wrapped);
        return () =>
          ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.saveProgress, wrapped);
      },
      getOpenWindowCount: async (): Promise<number> => {
        return await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.getOpenCount);
      },
      addItemToAllWindows: async (item: PlaylistItem): Promise<void> => {
        if (!isPlaylistItem(item)) {
          console.warn('Invalid playlist item rejected in preload');
          return;
        }
        await ipcRenderer.invoke(PLAYLIST_WINDOW_CHANNELS.addItemToAllWindows, item);
      },
      onAddItem: (callback: (item: PlaylistItem) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, item] = rawArgs as [IpcRendererEvent, PlaylistItem];
          if (!isPlaylistItem(item)) {
            console.warn('Invalid playlist item received in preload');
            return;
          }
          callback(item);
        };
        setMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.addItem,
          callback,
          wrapped,
        );
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.addItem, wrapped);
      },
      offAddItem: (callback: (item: PlaylistItem) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.addItem,
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.addItem, wrapped);
        removeMappedListener(
          listenerStore,
          PLAYLIST_WINDOW_CHANNELS.addItem,
          callback,
        );
      },
      setWindowTitle: (title: string) => {
        if (typeof title !== 'string') {
          console.warn('Invalid playlist title rejected in preload');
          return;
        }
        ipcRenderer.send(PLAYLIST_WINDOW_CHANNELS.setWindowTitle, title);
      },
      onRequestSave: (callback: () => void) => {
        const wrapped = () => callback();
        ipcRenderer.on(PLAYLIST_WINDOW_CHANNELS.requestSave, wrapped);
        return () =>
          ipcRenderer.removeListener(PLAYLIST_WINDOW_CHANNELS.requestSave, wrapped);
      },
      notifySavedAndClose: () => {
        ipcRenderer.send(PLAYLIST_WINDOW_CHANNELS.savedAndClose);
      },
    },
  } satisfies Pick<IElectronAPI, PlaylistBridgeKeys>;

  return playlistBridge;
};
