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
        const wrapped = (
          _event: IpcRendererEvent,
          command: PlaylistCommand,
        ) => {
          callback(command);
        };
        setMappedListener(
          listenerStore,
          'playlist:command',
          callback as unknown as Function,
          wrapped as unknown as (...args: unknown[]) => void,
        );
        ipcRenderer.on('playlist:command', wrapped);
      },
      offCommand: (callback: (command: PlaylistCommand) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:command',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'playlist:command',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'playlist:command',
          callback as unknown as Function,
        );
      },
      onWindowClosed: (callback: () => void) => {
        const wrapped = () => callback();
        setMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback as unknown as Function,
          wrapped,
        );
        ipcRenderer.on('playlist:window-closed', wrapped);
      },
      offWindowClosed: (callback: () => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'playlist:window-closed',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'playlist:window-closed',
          callback as unknown as Function,
        );
      },
      onSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = (_event: IpcRendererEvent, data: PlaylistSyncData) => {
          callback(data);
        };
        setMappedListener(
          listenerStore,
          'playlist:sync',
          callback as unknown as Function,
          wrapped as unknown as (...args: unknown[]) => void,
        );
        ipcRenderer.on('playlist:sync', wrapped);
      },
      offSync: (callback: (data: PlaylistSyncData) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:sync',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'playlist:sync',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'playlist:sync',
          callback as unknown as Function,
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
        const wrapped = (_event: IpcRendererEvent, item: PlaylistItem) => {
          callback(item);
        };
        setMappedListener(
          listenerStore,
          'playlist:add-item',
          callback as unknown as Function,
          wrapped as unknown as (...args: unknown[]) => void,
        );
        ipcRenderer.on('playlist:add-item', wrapped);
      },
      offAddItem: (callback: (item: PlaylistItem) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'playlist:add-item',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'playlist:add-item',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'playlist:add-item',
          callback as unknown as Function,
        );
      },
      setWindowTitle: (title: string) => {
        ipcRenderer.send('playlist:set-window-title', title);
      },
    },
  } satisfies Pick<IElectronAPI, PlaylistBridgeKeys>;

  return playlistBridge;
};
