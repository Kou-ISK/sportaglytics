import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';

export type AppBridgeMenuKeys =
  | 'onToggleLabelMode'
  | 'onExportTimeline'
  | 'onImportTimeline'
  | 'onCodingModeChange'
  | 'onOpenPackage'
  | 'onOpenRecentPackage'
  | 'updateRecentPackages';

export const createAppBridgeMenuApi = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, AppBridgeMenuKeys> => {
  return {
    onToggleLabelMode: (callback: (checked: boolean) => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-toggle-label-mode');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-toggle-label-mode', (_event, checked: boolean) => {
        callback(checked);
      });
    },
    onExportTimeline: (callback: (format: string) => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-export-timeline');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-export-timeline', (_event, format: string) => {
        callback(format);
      });
    },
    onImportTimeline: (callback: () => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-import-timeline');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-import-timeline', (_event: IpcRendererEvent) => {
        callback();
      });
    },
    onCodingModeChange: (callback: (mode: 'code' | 'label') => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-coding-mode');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-coding-mode', (_event, mode: 'code' | 'label') => {
        callback(mode);
      });
    },
    onOpenPackage: (callback: () => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-open-package');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-open-package', () => {
        callback();
      });
    },
    onOpenRecentPackage: (callback: (path: string) => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-open-recent-package');
      } catch {
        // ignore
      }
      ipcRenderer.on('menu-open-recent-package', (_event, path: string) => {
        callback(path);
      });
    },
    updateRecentPackages: (paths: string[]) => {
      ipcRenderer.send('recent-packages:update', paths);
    },
  };
};
