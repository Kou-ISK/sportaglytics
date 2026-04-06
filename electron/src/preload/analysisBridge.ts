import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import {
  ANALYSIS_WINDOW_CHANNELS,
  isAnalysisAiPlaylistPayload,
  isAnalysisWindowSyncPayload,
  isTimelineData,
  type AnalysisAiPlaylistPayload,
  type AnalysisWindowSyncPayload,
} from '../../../src/types/ipc/analysisWindow';
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
          await ipcRenderer.invoke(ANALYSIS_WINDOW_CHANNELS.openWindow);
        } catch (error) {
          console.error('Error opening analysis window:', error);
        }
      },
      closeWindow: async () => {
        try {
          await ipcRenderer.invoke(ANALYSIS_WINDOW_CHANNELS.closeWindow);
        } catch (error) {
          console.error('Error closing analysis window:', error);
        }
      },
      isWindowOpen: async () => {
        try {
          return await ipcRenderer.invoke(ANALYSIS_WINDOW_CHANNELS.isWindowOpen);
        } catch (error) {
          console.error('Error checking analysis window state:', error);
          return false;
        }
      },
      syncToWindow: (data: AnalysisWindowSyncPayload) => {
        if (!isAnalysisWindowSyncPayload(data)) {
          console.warn('Invalid analysis sync payload rejected in preload');
          return;
        }
        ipcRenderer.send(ANALYSIS_WINDOW_CHANNELS.syncToWindow, data);
      },
      onSync: (callback: (data: AnalysisWindowSyncPayload) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, data] = rawArgs as [
            IpcRendererEvent,
            AnalysisWindowSyncPayload,
          ];
          if (!isAnalysisWindowSyncPayload(data)) {
            console.warn('Invalid analysis sync payload received in preload');
            return;
          }
          callback(data);
        };
        setMappedListener(
          listenerStore,
          ANALYSIS_WINDOW_CHANNELS.sync,
          callback,
          wrapped,
        );
        ipcRenderer.on(ANALYSIS_WINDOW_CHANNELS.sync, wrapped);
      },
      offSync: (callback: (data: AnalysisWindowSyncPayload) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          ANALYSIS_WINDOW_CHANNELS.sync,
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener(ANALYSIS_WINDOW_CHANNELS.sync, wrapped);
        removeMappedListener(
          listenerStore,
          ANALYSIS_WINDOW_CHANNELS.sync,
          callback,
        );
      },
      sendJumpToSegment: (segment: TimelineData) => {
        if (!isTimelineData(segment)) {
          console.warn('Invalid analysis jump segment rejected in preload');
          return;
        }
        ipcRenderer.send(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, segment);
      },
      sendCreateAiPlaylist: (payload: AnalysisAiPlaylistPayload) => {
        if (!isAnalysisAiPlaylistPayload(payload)) {
          console.warn('Invalid analysis AI playlist payload rejected in preload');
          return;
        }
        ipcRenderer.send(ANALYSIS_WINDOW_CHANNELS.createAiPlaylist, payload);
      },
      onJumpToSegment: (callback: (segment: TimelineData) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, segment] = rawArgs as [IpcRendererEvent, TimelineData];
          if (!isTimelineData(segment)) {
            console.warn('Invalid analysis jump segment received in preload');
            return;
          }
          callback(segment);
        };
        ipcRenderer.on(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, wrapped);
        return () =>
          ipcRenderer.removeListener(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, wrapped);
      },
      onCreateAiPlaylist: (
        callback: (payload: AnalysisAiPlaylistPayload) => void,
      ) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, payload] = rawArgs as [IpcRendererEvent, AnalysisAiPlaylistPayload];
          if (!isAnalysisAiPlaylistPayload(payload)) {
            console.warn('Invalid analysis AI playlist payload received in preload');
            return;
          }
          callback(payload);
        };
        ipcRenderer.on(ANALYSIS_WINDOW_CHANNELS.createAiPlaylist, wrapped);
        return () =>
          ipcRenderer.removeListener(
            ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
            wrapped,
          );
      },
      onDashboardExternalOpen: (callback: (filePath: string) => void) => {
        const wrapped = (...rawArgs: unknown[]) => {
          const [, filePath] = rawArgs as [IpcRendererEvent, unknown];
          if (typeof filePath !== 'string' || filePath.length === 0) {
            console.warn('Invalid analysis dashboard path received in preload');
            return;
          }
          callback(filePath);
        };
        ipcRenderer.on(ANALYSIS_WINDOW_CHANNELS.dashboardExternalOpen, wrapped);
        return () =>
          ipcRenderer.removeListener(
            ANALYSIS_WINDOW_CHANNELS.dashboardExternalOpen,
            wrapped,
          );
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
        const wrapped = (...rawArgs: unknown[]) => {
          const [, payload] = rawArgs as [IpcRendererEvent, unknown];
          callback(payload);
        };
        setMappedListener(
          listenerStore,
          'llama:progress',
          callback,
          wrapped,
        );
        ipcRenderer.on('llama:progress', wrapped);
      },
      offProgress: (callback: (payload: unknown) => void) => {
        const wrapped = getMappedListener(
          listenerStore,
          'llama:progress',
          callback,
        );
        if (!wrapped) {
          return;
        }

        ipcRenderer.removeListener('llama:progress', wrapped);
        removeMappedListener(
          listenerStore,
          'llama:progress',
          callback,
        );
      },
    },
  } satisfies Pick<IElectronAPI, AnalysisBridgeKeys>;

  return analysisAndLlamaBridge;
};
