import { IpcRendererEvent, ipcRenderer } from 'electron';
import type { AnalysisReportPayload } from '../../../src/report/types';
import type { AnalysisView } from '../../../src/types/AnalysisView';
import type { TimelineData } from '../../../src/types/TimelineData';
import type { PlaylistItem } from '../../../src/types/Playlist';
import type { IElectronAPI } from '../../../src/renderer';
import {
  getMappedListener,
  removeMappedListener,
  setMappedListener,
  type ListenerStore,
} from './listenerStore';

type RegisterListener = <T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void,
) => () => void;

type EventBridgeKeys =
  | 'onAnalysisJumpToSegment'
  | 'onAnalysisCreateAiPlaylist'
  | 'onMenuShowStats'
  | 'onTimelineUndo'
  | 'onTimelineRedo'
  | 'onMenuExportAnalysisRawCsv'
  | 'onMenuShowShortcuts'
  | 'onAnalysisDashboardExternalOpen'
  | 'onMenuExportClips'
  | 'onPlaylistRequestSave'
  | 'notifyPlaylistSavedAndClose'
  | 'notifyHotkeysUpdated'
  | 'onAnalysisReportPayload'
  | 'notifyAnalysisReportRenderReady'
  | 'onResyncAudio'
  | 'offResyncAudio'
  | 'onResetSync'
  | 'offResetSync'
  | 'onManualSync'
  | 'offManualSync'
  | 'onSetSyncMode'
  | 'offSetSyncMode';

export const createEventBridge = (
  registerListener: RegisterListener,
  listenerStore: ListenerStore,
): Pick<IElectronAPI, EventBridgeKeys> => ({
  onAnalysisJumpToSegment: (callback: (segment: TimelineData) => void) =>
    registerListener('analysis:jump-to-segment', callback),
  onAnalysisCreateAiPlaylist: (
    callback: (payload: { name?: string; items?: PlaylistItem[] }) => void,
  ) => registerListener('analysis:create-ai-playlist', callback),
  onMenuShowStats: (callback: (requestedView?: AnalysisView) => void) =>
    registerListener('menu-show-stats', callback),
  onTimelineUndo: (callback: () => void) =>
    registerListener('timeline-undo', callback),
  onTimelineRedo: (callback: () => void) =>
    registerListener('timeline-redo', callback),
  onMenuExportAnalysisRawCsv: (callback: () => void) =>
    registerListener('menu-export-analysis-raw-csv', callback),
  onMenuShowShortcuts: (callback: () => void) =>
    registerListener('menu-show-shortcuts', callback),
  onAnalysisDashboardExternalOpen: (callback: (filePath: string) => void) =>
    registerListener('analysis-dashboard:external-open', callback),
  onMenuExportClips: (callback: () => void) =>
    registerListener('menu-export-clips', callback),
  onPlaylistRequestSave: (callback: () => void) =>
    registerListener('playlist:request-save', callback),
  notifyPlaylistSavedAndClose: () => {
    ipcRenderer.send('playlist:saved-and-close');
  },
  notifyHotkeysUpdated: () => {
    ipcRenderer.send('hotkeys-updated');
  },
  onAnalysisReportPayload: (
    callback: (message: {
      requestId?: string;
      payload?: AnalysisReportPayload;
    }) => void,
  ) => registerListener('analysis-report:payload', callback),
  notifyAnalysisReportRenderReady: (requestId: string) => {
    ipcRenderer.send('analysis-report:render-ready', requestId);
  },
  onResyncAudio: (callback: () => void) => {
    const existing = getMappedListener(
      listenerStore,
      'menu-resync-audio',
      callback,
    );
    if (existing) {
      ipcRenderer.removeListener('menu-resync-audio', existing);
    }

    const wrapped = (...rawArgs: unknown[]) => {
      const [event] = rawArgs as [IpcRendererEvent];
      void event;
      callback();
    };

    setMappedListener(listenerStore, 'menu-resync-audio', callback, wrapped);
    ipcRenderer.on('menu-resync-audio', wrapped);
  },
  offResyncAudio: (callback: () => void) => {
    const wrapped = getMappedListener(
      listenerStore,
      'menu-resync-audio',
      callback,
    );
    if (!wrapped) {
      return;
    }
    ipcRenderer.removeListener('menu-resync-audio', wrapped);
    removeMappedListener(listenerStore, 'menu-resync-audio', callback);
  },
  onResetSync: (callback: () => void) => {
    const existing = getMappedListener(
      listenerStore,
      'menu-reset-sync',
      callback,
    );
    if (existing) {
      ipcRenderer.removeListener('menu-reset-sync', existing);
    }

    const wrapped = (...rawArgs: unknown[]) => {
      const [event] = rawArgs as [IpcRendererEvent];
      void event;
      callback();
    };

    setMappedListener(listenerStore, 'menu-reset-sync', callback, wrapped);
    ipcRenderer.on('menu-reset-sync', wrapped);
  },
  offResetSync: (callback: () => void) => {
    const wrapped = getMappedListener(
      listenerStore,
      'menu-reset-sync',
      callback,
    );
    if (!wrapped) {
      return;
    }
    ipcRenderer.removeListener('menu-reset-sync', wrapped);
    removeMappedListener(listenerStore, 'menu-reset-sync', callback);
  },
  onManualSync: (callback: () => void) => {
    const existing = getMappedListener(
      listenerStore,
      'menu-manual-sync',
      callback,
    );
    if (existing) {
      ipcRenderer.removeListener('menu-manual-sync', existing);
    }

    const wrapped = (...rawArgs: unknown[]) => {
      const [event] = rawArgs as [IpcRendererEvent];
      void event;
      callback();
    };

    setMappedListener(listenerStore, 'menu-manual-sync', callback, wrapped);
    ipcRenderer.on('menu-manual-sync', wrapped);
  },
  offManualSync: (callback: () => void) => {
    const wrapped = getMappedListener(
      listenerStore,
      'menu-manual-sync',
      callback,
    );
    if (!wrapped) {
      return;
    }
    ipcRenderer.removeListener('menu-manual-sync', wrapped);
    removeMappedListener(listenerStore, 'menu-manual-sync', callback);
  },
  onSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    const existing = getMappedListener(
      listenerStore,
      'menu-set-sync-mode',
      callback,
    );
    if (existing) {
      ipcRenderer.removeListener('menu-set-sync-mode', existing);
    }

    const wrapped = (...rawArgs: unknown[]) => {
      const [, mode] = rawArgs as [IpcRendererEvent, 'auto' | 'manual'];
      callback(mode);
    };

    setMappedListener(listenerStore, 'menu-set-sync-mode', callback, wrapped);
    ipcRenderer.on('menu-set-sync-mode', wrapped);
  },
  offSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    const wrapped = getMappedListener(
      listenerStore,
      'menu-set-sync-mode',
      callback,
    );
    if (!wrapped) {
      return;
    }
    ipcRenderer.removeListener('menu-set-sync-mode', wrapped);
    removeMappedListener(listenerStore, 'menu-set-sync-mode', callback);
  },
});
