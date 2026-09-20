import type { IpcRenderer } from 'electron';
import {
  EVENT_DETECTION_WINDOW_CHANNELS as channels,
  isEventDetectionWindowCommand,
  isEventDetectionWindowState,
  type IEventDetectionWindowAPI,
} from '../../../src/types/ipc/eventDetectionWindow';
export const createEventDetectionWindowBridge = (
  ipc: IpcRenderer,
): IEventDetectionWindowAPI => ({
  open: () => ipc.invoke(channels.open),
  hide: () => ipc.invoke(channels.hide),
  publish: (state) => ipc.send(channels.publish, state),
  requestState: () => ipc.invoke(channels.request),
  command: (command) => ipc.send(channels.command, command),
  onState: (callback) => {
    const listener = (_event: unknown, state: unknown): void => {
      if (state === null || isEventDetectionWindowState(state)) callback(state);
    };
    ipc.on(channels.state, listener);
    return () => ipc.removeListener(channels.state, listener);
  },
  onCommand: (callback) => {
    const listener = (_event: unknown, command: unknown): void => {
      if (isEventDetectionWindowCommand(command)) callback(command);
    };
    ipc.on(channels.command, listener);
    return () => ipc.removeListener(channels.command, listener);
  },
});
