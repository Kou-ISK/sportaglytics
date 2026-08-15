import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import type { EventDetectionProgress } from '../../../src/types/eventDetection/core';
import {
  EVENT_DETECTION_CHANNELS,
  isEventDetectionProgress,
  type IEventDetectionAPI,
} from '../../../src/types/ipc/eventDetection';
import {
  getMappedListener,
  removeMappedListener,
  setMappedListener,
  type ListenerStore,
} from './listenerStore';

export const createEventDetectionBridge = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): Pick<IElectronAPI, 'eventDetection'> => ({
  eventDetection: {
    listModels: async () => {
      return ipcRenderer.invoke(EVENT_DETECTION_CHANNELS.listModels);
    },
    run: async (request) => {
      return ipcRenderer.invoke(EVENT_DETECTION_CHANNELS.run, request);
    },
    cancel: async (requestId) => {
      return ipcRenderer.invoke(EVENT_DETECTION_CHANNELS.cancel, requestId);
    },
    onProgress: (callback: (progress: EventDetectionProgress) => void) => {
      const wrapped = (...rawArgs: unknown[]) => {
        const [, progress] = rawArgs as [IpcRendererEvent, unknown];
        if (!isEventDetectionProgress(progress)) return;
        callback(progress);
      };
      setMappedListener(
        listenerStore,
        EVENT_DETECTION_CHANNELS.progress,
        callback,
        wrapped,
      );
      ipcRenderer.on(EVENT_DETECTION_CHANNELS.progress, wrapped);
    },
    offProgress: (callback: (progress: EventDetectionProgress) => void) => {
      const wrapped = getMappedListener(
        listenerStore,
        EVENT_DETECTION_CHANNELS.progress,
        callback,
      );
      if (!wrapped) return;
      ipcRenderer.removeListener(EVENT_DETECTION_CHANNELS.progress, wrapped);
      removeMappedListener(
        listenerStore,
        EVENT_DETECTION_CHANNELS.progress,
        callback,
      );
    },
  } satisfies IEventDetectionAPI,
});
