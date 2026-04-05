import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import type {
  Playlist,
  PlaylistCommand,
  PlaylistItem,
  PlaylistSyncData,
} from '../../../src/types/Playlist';
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
        await ipcRenderer.invoke('playlist:open-window');
      },
      closeWindow: async () => {
        await ipcRenderer.invoke('playlist:close-window');
      },
      isWindowOpen: async (): Promise<boolean> => {
        return await ipcRenderer.invoke('playlist:is-window-open');
      },
      syncToWindow: (data: PlaylistSyncData) => {
        ipcRenderer.send('playlist:sync-to-window', data);
      },
      onCommand: (callback: (command: PlaylistCommand) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, command] = rawArgs as [IpcRendererEvent, PlaylistCommand];
          callback(command);
        };
        setMappedListener(
          listenerStore,
          'playlist:command',
          callback,
          wrapped,
        );
        ipcRenderer.on('playlist:command', wrapped);
      },
      offCommand: (callback: (command: PlaylistCommand) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:command',
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener('playlist:command', wrapped);
        removeMappedListener(
          listenerStore,
          'playlist:command',
          callback,
        );
      },
      onWindowClosed: (callback: () => void) => {
        const wrapped = () => callback();
        setMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback,
          wrapped,
        );
        ipcRenderer.on('playlist:window-closed', wrapped);
      },
      offWindowClosed: (callback: () => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener('playlist:window-closed', wrapped);
        removeMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback,
        );
      },
      onSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, data] = rawArgs as [IpcRendererEvent, PlaylistSyncData];
          callback(data);
        };
        setMappedListener(
          listenerStore,
          'playlist:sync',
          callback,
          wrapped,
        );
        ipcRenderer.on('playlist:sync', wrapped);
      },
      offSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:sync',
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener('playlist:sync', wrapped);
        removeMappedListener(
          listenerStore,
          'playlist:sync',
          callback,
        );
      },
      sendCommand: (command: PlaylistCommand) => {
        ipcRenderer.send('playlist:command', command);
      },
      savePlaylistFile: async (playlist: Playlist): Promise<string | null> => {
        return await ipcRenderer.invoke('playlist:save-file', playlist);
      },
      savePlaylistFileAs: async (playlist: Playlist): Promise<string | null> => {
        return await ipcRenderer.invoke('playlist:save-file-as', playlist);
      },
      loadPlaylistFile: async (
        filePath?: string,
      ): Promise<{ playlist: Playlist; filePath: string } | null> => {
        return await ipcRenderer.invoke('playlist:load-file', filePath);
      },
      onExternalOpen: (callback: (filePath: string) => void) => {
        const wrapped = (_: unknown, path: string) => callback(path);
        ipcRenderer.on('playlist:external-open', wrapped);
        return () =>
          ipcRenderer.removeListener('playlist:external-open', wrapped);
      },
      onSaveProgress: (
        callback: (data: { current: number; total: number }) => void,
      ) => {
        const wrapped = (_: unknown, data: { current: number; total: number }) =>
          callback(data);
        ipcRenderer.on('playlist:save-progress', wrapped);
        return () =>
          ipcRenderer.removeListener('playlist:save-progress', wrapped);
      },
      getOpenWindowCount: async (): Promise<number> => {
        return await ipcRenderer.invoke('playlist:get-open-count');
      },
      addItemToAllWindows: async (item: PlaylistItem): Promise<void> => {
        await ipcRenderer.invoke('playlist:add-item-to-all-windows', item);
      },
      onAddItem: (callback: (item: PlaylistItem) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, item] = rawArgs as [IpcRendererEvent, PlaylistItem];
          callback(item);
        };
        setMappedListener(
          listenerStore,
          'playlist:add-item',
          callback,
          wrapped,
        );
        ipcRenderer.on('playlist:add-item', wrapped);
      },
      offAddItem: (callback: (item: PlaylistItem) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:add-item',
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener('playlist:add-item', wrapped);
        removeMappedListener(
          listenerStore,
          'playlist:add-item',
          callback,
        );
      },
      setWindowTitle: (title: string) => {
        ipcRenderer.send('playlist:set-window-title', title);
      },
    },
  } satisfies Pick<IElectronAPI, PlaylistBridgeKeys>;

  return playlistBridge;
};
