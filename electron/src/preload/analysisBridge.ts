import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type {
  AnalysisWindowSyncPayload,
  IElectronAPI,
} from '../../../src/renderer';
import type { PlaylistItem } from '../../../src/types/Playlist';
import type { TimelineData } from '../../../src/types/TimelineData';
import {
  getMappedListener,
  removeMappedListener,
  setMappedListener,
  type ListenerStore,
} from './listenerStore';

type AnalysisBridgeKeys = 'analysis' | 'llama';

export const createAnalysisBridge = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): Pick<IElectronAPI, AnalysisBridgeKeys> => {
  const analysisAndLlamaBridge = {
    analysis: {
      openWindow: async () => {
        try {
          await ipcRenderer.invoke('analysis:open-window');
        } catch (error) {
          console.error('Error opening analysis window:', error);
        }
      },
      closeWindow: async () => {
        try {
          await ipcRenderer.invoke('analysis:close-window');
        } catch (error) {
          console.error('Error closing analysis window:', error);
        }
      },
      isWindowOpen: async () => {
        try {
          return await ipcRenderer.invoke('analysis:is-window-open');
        } catch (error) {
          console.error('Error checking analysis window state:', error);
          return false;
        }
      },
      syncToWindow: (data: AnalysisWindowSyncPayload) => {
        ipcRenderer.send('analysis:sync-to-window', data);
      },
      onSync: (callback: (data: AnalysisWindowSyncPayload) => void) => {
        const wrapped = (
          _event: IpcRendererEvent,
          data: AnalysisWindowSyncPayload,
        ) => {
          callback(data);
        };
        setMappedListener(
          listenerStore,
          'analysis:sync',
          callback as unknown as Function,
          wrapped as unknown as (...args: unknown[]) => void,
        );
        ipcRenderer.on('analysis:sync', wrapped);
      },
      offSync: (callback: (data: AnalysisWindowSyncPayload) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'analysis:sync',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'analysis:sync',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'analysis:sync',
          callback as unknown as Function,
        );
      },
      sendJumpToSegment: (segment: TimelineData) => {
        ipcRenderer.send('analysis:jump-to-segment', segment);
      },
      sendCreateAiPlaylist: (payload: {
        name: string;
        items: PlaylistItem[];
      }) => {
        ipcRenderer.send('analysis:create-ai-playlist', payload);
      },
    },
    llama: {
      generate: async (payload: unknown) => {
        try {
          return await ipcRenderer.invoke('llama:generate', payload);
        } catch (error) {
          console.error('Error generating with llama.cpp:', error);
          throw error;
        }
      },
      cancel: async (requestId: string) => {
        try {
          return await ipcRenderer.invoke('llama:cancel', requestId);
        } catch (error) {
          console.error('Error cancelling llama.cpp:', error);
          return false;
        }
      },
      listModels: async () => {
        try {
          return await ipcRenderer.invoke('llama:list-models');
        } catch (error) {
          console.error('Error listing llama.cpp models:', error);
          return [];
        }
      },
      onProgress: (callback: (payload: unknown) => void) => {
        const wrapped = (_event: IpcRendererEvent, payload: unknown) => {
          callback(payload);
        };
        setMappedListener(
          listenerStore,
          'llama:progress',
          callback as unknown as Function,
          wrapped as unknown as (...args: unknown[]) => void,
        );
        ipcRenderer.on('llama:progress', wrapped);
      },
      offProgress: (callback: (payload: unknown) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'llama:progress',
          callback as unknown as Function,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(
          'llama:progress',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        removeMappedListener(
          listenerStore,
          'llama:progress',
          callback as unknown as Function,
        );
      },
    },
  } satisfies Pick<IElectronAPI, AnalysisBridgeKeys>;

  return analysisAndLlamaBridge;
};
