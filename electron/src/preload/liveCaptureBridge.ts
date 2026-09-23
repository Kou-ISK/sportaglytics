import type { IpcRenderer } from 'electron';
import type {
  CaptureSnapshot,
  ILiveCaptureAPI,
} from '../../../src/types/liveCapture';
import { LIVE_CAPTURE_CHANNELS as channels } from '../../../src/types/ipc/liveCapture';

export const createLiveCaptureBridge = (ipc: IpcRenderer): ILiveCaptureAPI => ({
  open: () => ipc.invoke(channels.open),
  hide: () => ipc.invoke(channels.hide),
  authorizeDevices: () => ipc.invoke(channels.authorize),
  capabilities: () => ipc.invoke(channels.capabilities),
  start: (request) => ipc.invoke(channels.start, request),
  append: (chunk) => ipc.invoke(channels.append, chunk),
  endInput: (id, inputId) => ipc.invoke(channels.endInput, id, inputId),
  retry: (id, inputId) => ipc.invoke(channels.retry, id, inputId),
  stop: (id) => ipc.invoke(channels.stop, id),
  getState: () => ipc.invoke(channels.request),
  onState: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: CaptureSnapshot | null,
    ): void => callback(state);
    ipc.on(channels.state, listener);
    return () => {
      ipc.removeListener(channels.state, listener);
    };
  },
  onStopRequest: (callback) => {
    const listener = (): void => callback();
    ipc.on(channels.stopRequested, listener);
    return () => {
      ipc.removeListener(channels.stopRequested, listener);
    };
  },
});
