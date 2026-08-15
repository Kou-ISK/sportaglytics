import type { IpcRenderer, IpcRendererEvent } from 'electron';
import {
  TIMELINE_WINDOW_CHANNELS,
  isTimelineWindowCommand,
  isTimelineWindowClockPayload,
  isTimelineWindowSyncPayload,
  type ITimelineWindowAPI,
  type TimelineWindowCommand,
  type TimelineWindowClockPayload,
  type TimelineWindowSyncPayload,
} from '../../../src/types/ipc/timelineWindow';
import type { ListenerStore } from './listenerStore';

export const createTimelineWindowBridge = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): ITimelineWindowAPI => {
  const subscribe = <T>(
    channel: string,
    callback: (payload: T) => void,
    guard: (payload: unknown) => payload is T,
  ): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => {
      if (guard(payload)) callback(payload);
    };
    const channelListeners = listenerStore.get(channel) ?? new Map();
    channelListeners.set(callback, wrapped);
    listenerStore.set(channel, channelListeners);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.off(channel, wrapped);
      channelListeners.delete(callback);
    };
  };

  return {
    openWindow: () => ipcRenderer.invoke(TIMELINE_WINDOW_CHANNELS.openWindow),
    closeWindow: () => ipcRenderer.invoke(TIMELINE_WINDOW_CHANNELS.closeWindow),
    isWindowOpen: () =>
      ipcRenderer.invoke(TIMELINE_WINDOW_CHANNELS.isWindowOpen),
    syncToWindow: (payload: TimelineWindowSyncPayload) => {
      if (isTimelineWindowSyncPayload(payload)) {
        ipcRenderer.send(TIMELINE_WINDOW_CHANNELS.syncToWindow, payload);
      }
    },
    syncClockToWindow: (payload: TimelineWindowClockPayload) => {
      if (isTimelineWindowClockPayload(payload)) {
        ipcRenderer.send(TIMELINE_WINDOW_CHANNELS.clockToWindow, payload);
      }
    },
    sendCommand: (command: TimelineWindowCommand) => {
      if (isTimelineWindowCommand(command)) {
        ipcRenderer.send(TIMELINE_WINDOW_CHANNELS.command, command);
      }
    },
    onSync: (callback) =>
      subscribe(
        TIMELINE_WINDOW_CHANNELS.sync,
        callback,
        isTimelineWindowSyncPayload,
      ),
    onClock: (callback) =>
      subscribe(
        TIMELINE_WINDOW_CHANNELS.clock,
        callback,
        isTimelineWindowClockPayload,
      ),
    onCommand: (callback) =>
      subscribe(
        TIMELINE_WINDOW_CHANNELS.command,
        callback,
        isTimelineWindowCommand,
      ),
    onVisibilityChange: (callback) =>
      subscribe(
        TIMELINE_WINDOW_CHANNELS.visibility,
        callback,
        (value: unknown): value is boolean => typeof value === 'boolean',
      ),
  };
};
