import { IpcRendererEvent, ipcRenderer } from 'electron';
import type { AnalysisReportPayload } from '../../../src/report/types';
import type { AnalysisView } from '../../../src/types/AnalysisView';
import type { TimelineData } from '../../../src/types/TimelineData';
import type { PlaylistItem } from '../../../src/types/Playlist';
import type { IElectronAPI } from '../../../src/renderer';

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
    try {
      ipcRenderer.removeAllListeners('menu-resync-audio');
    } catch {
      // ignore
    }
    ipcRenderer.on(
      'menu-resync-audio',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  offResyncAudio: (callback: () => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-resync-audio',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    } catch {
      /* noop */
    }
  },
  onResetSync: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-reset-sync');
    } catch {
      // ignore
    }
    ipcRenderer.on(
      'menu-reset-sync',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  offResetSync: (callback: () => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-reset-sync',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    } catch {
      /* noop */
    }
  },
  onManualSync: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-manual-sync');
    } catch {
      // ignore
    }
    ipcRenderer.on(
      'menu-manual-sync',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  offManualSync: (callback: () => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-manual-sync',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    } catch {
      /* noop */
    }
  },
  onSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-set-sync-mode');
    } catch {
      // ignore
    }
    ipcRenderer.on('menu-set-sync-mode', (_event, mode: 'auto' | 'manual') =>
      callback(mode),
    );
  },
  offSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-set-sync-mode',
        callback as unknown as (
          event: IpcRendererEvent,
          mode: 'auto' | 'manual',
        ) => void,
      );
    } catch {
      /* noop */
    }
  },
});

