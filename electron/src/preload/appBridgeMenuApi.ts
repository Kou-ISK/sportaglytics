import type { IpcRenderer } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import type { RegisterListener } from './listenerStore';

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
  registerListener: RegisterListener,
): Pick<IElectronAPI, AppBridgeMenuKeys> => {
  return {
    onToggleLabelMode: (callback: (checked: boolean) => void) =>
      registerListener('menu-toggle-label-mode', (checked: unknown) => {
        if (typeof checked !== 'boolean') {
          return;
        }
        callback(checked);
      }),
    onExportTimeline: (callback: (format: string) => void) =>
      registerListener('menu-export-timeline', (format: unknown) => {
        if (typeof format !== 'string') {
          return;
        }
        callback(format);
      }),
    onImportTimeline: (callback: () => void) =>
      registerListener('menu-import-timeline', () => {
        callback();
      }),
    onCodingModeChange: (callback: (mode: 'code' | 'label') => void) =>
      registerListener('menu-coding-mode', (mode: unknown) => {
        if (mode !== 'code' && mode !== 'label') {
          return;
        }
        callback(mode);
      }),
    onOpenPackage: (callback: () => void) =>
      registerListener('menu-open-package', () => {
        callback();
      }),
    onOpenRecentPackage: (callback: (path: string) => void) =>
      registerListener('menu-open-recent-package', (path: unknown) => {
        if (typeof path !== 'string') {
          return;
        }
        callback(path);
      }),
    updateRecentPackages: (paths: string[]) => {
      ipcRenderer.send('recent-packages:update', paths);
    },
  };
};
