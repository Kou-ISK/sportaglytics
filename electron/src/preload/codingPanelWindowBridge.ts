import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type {
  CodingPanelWindowCommand,
  CodingPanelWindowSyncPayload,
  ICodingPanelWindowAPI,
} from '../../../src/types/ipc/codingPanelWindow';
import {
  CODING_PANEL_WINDOW_CHANNELS,
  isCodingPanelWindowCommand,
  isCodingPanelWindowSyncPayload,
} from '../../../src/types/ipc/codingPanelWindow';
import {
  getMappedListener,
  removeMappedListener,
  setMappedListener,
  type ListenerStore,
} from './listenerStore';

export const createCodingPanelWindowBridge = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): ICodingPanelWindowAPI => {
  const removeChannelListeners = (channel: string): void => {
    const listeners = listenerStore.get(channel);
    if (!listeners) return;
    for (const wrapped of listeners.values()) {
      ipcRenderer.off(channel, wrapped);
    }
    listenerStore.delete(channel);
  };

  return {
    openWindow: () =>
      ipcRenderer.invoke(CODING_PANEL_WINDOW_CHANNELS.openWindow),
    closeWindow: () =>
      ipcRenderer.invoke(CODING_PANEL_WINDOW_CHANNELS.closeWindow),
    isWindowOpen: () =>
      ipcRenderer.invoke(CODING_PANEL_WINDOW_CHANNELS.isWindowOpen),
    syncToWindow: (payload: CodingPanelWindowSyncPayload) => {
      if (!isCodingPanelWindowSyncPayload(payload)) {
        console.warn('Invalid coding panel sync payload rejected in preload');
        return;
      }
      ipcRenderer.send(CODING_PANEL_WINDOW_CHANNELS.syncToWindow, payload);
    },
    sendCommand: (command: CodingPanelWindowCommand) => {
      if (!isCodingPanelWindowCommand(command)) {
        console.warn('Invalid coding panel command rejected in preload');
        return;
      }
      ipcRenderer.send(CODING_PANEL_WINDOW_CHANNELS.command, command);
    },
    onSync: (callback: (payload: CodingPanelWindowSyncPayload) => void) => {
      // contextBridge does not guarantee callback proxy identity across
      // separate on/off calls. This channel has one renderer subscriber, so
      // replace any previous wrapped listener explicitly before subscribing.
      removeChannelListeners(CODING_PANEL_WINDOW_CHANNELS.sync);
      const wrapped = (...rawArgs: unknown[]) => {
        const [, payload] = rawArgs as [
          IpcRendererEvent,
          CodingPanelWindowSyncPayload,
        ];
        if (!isCodingPanelWindowSyncPayload(payload)) {
          console.warn('Invalid coding panel sync payload received in preload');
          return;
        }
        callback(payload as CodingPanelWindowSyncPayload);
      };
      setMappedListener(
        listenerStore,
        CODING_PANEL_WINDOW_CHANNELS.sync,
        callback,
        wrapped,
      );
      ipcRenderer.on(CODING_PANEL_WINDOW_CHANNELS.sync, wrapped);
    },
    offSync: (callback: (payload: CodingPanelWindowSyncPayload) => void) => {
      const wrapped = getMappedListener(
        listenerStore,
        CODING_PANEL_WINDOW_CHANNELS.sync,
        callback,
      );
      if (wrapped) {
        ipcRenderer.off(CODING_PANEL_WINDOW_CHANNELS.sync, wrapped);
        removeMappedListener(
          listenerStore,
          CODING_PANEL_WINDOW_CHANNELS.sync,
          callback,
        );
        return;
      }
      removeChannelListeners(CODING_PANEL_WINDOW_CHANNELS.sync);
    },
    onCommand: (callback: (command: CodingPanelWindowCommand) => void) => {
      removeChannelListeners(CODING_PANEL_WINDOW_CHANNELS.command);
      const wrapped = (...rawArgs: unknown[]) => {
        const [, command] = rawArgs as [
          IpcRendererEvent,
          CodingPanelWindowCommand,
        ];
        if (!isCodingPanelWindowCommand(command)) {
          console.warn('Invalid coding panel command received in preload');
          return;
        }
        callback(command as CodingPanelWindowCommand);
      };
      setMappedListener(
        listenerStore,
        CODING_PANEL_WINDOW_CHANNELS.command,
        callback,
        wrapped,
      );
      ipcRenderer.on(CODING_PANEL_WINDOW_CHANNELS.command, wrapped);
    },
    offCommand: (callback: (command: CodingPanelWindowCommand) => void) => {
      const wrapped = getMappedListener(
        listenerStore,
        CODING_PANEL_WINDOW_CHANNELS.command,
        callback,
      );
      if (wrapped) {
        ipcRenderer.off(CODING_PANEL_WINDOW_CHANNELS.command, wrapped);
        removeMappedListener(
          listenerStore,
          CODING_PANEL_WINDOW_CHANNELS.command,
          callback,
        );
        return;
      }
      removeChannelListeners(CODING_PANEL_WINDOW_CHANNELS.command);
    },
  };
};
