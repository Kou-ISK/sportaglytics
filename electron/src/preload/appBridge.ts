import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI, PackageDatas } from '../../../src/renderer';

type AppBridgeKeys =
  | 'openFile'
  | 'openDirectory'
  | 'exportTimeline'
  | 'createPackage'
  | 'saveSyncData'
  | 'checkFileExists'
  | 'readJsonFile'
  | 'setManualModeChecked'
  | 'setLabelModeChecked'
  | 'onToggleLabelMode'
  | 'convertConfigToRelativePath'
  | 'setWindowTitle'
  | 'exportClipsWithOverlay'
  | 'saveFileDialog'
  | 'openFileDialog'
  | 'openDashboardPackageDialog'
  | 'saveDashboardPackage'
  | 'readDashboardPackage'
  | 'writeTextFile'
  | 'writeBinaryFile'
  | 'captureWindowRegionAsPng'
  | 'writePdfFileFromHtml'
  | 'printAnalysisReportPdf'
  | 'readTextFile'
  | 'readBinaryFile'
  | 'onExportTimeline'
  | 'onImportTimeline'
  | 'onCodingModeChange'
  | 'onOpenPackage'
  | 'onOpenRecentPackage'
  | 'updateRecentPackages';

export const createAppBridge = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, AppBridgeKeys> => {
  const appBridge = {
    openFile: async () => {
      try {
        const filePath = await ipcRenderer.invoke('open-file');
        return filePath;
      } catch (error) {
        console.error('Error:', error);
        return null;
      }
    },
    openDirectory: async () => {
      try {
        const filePath = await ipcRenderer.invoke('open-directory');
        return filePath;
      } catch (error) {
        console.error('Error:', error);
        return null;
      }
    },
    exportTimeline: async (filePath: string, source: unknown) => {
      try {
        await ipcRenderer.invoke('export-timeline', filePath, source);
      } catch (error) {
        console.error('Error exporting timeline:', error);
      }
    },
    createPackage: async (
      directoryName: string,
      packageName: string,
      angles: Array<{
        id: string;
        name: string;
        sourcePath: string;
        role?: 'primary' | 'secondary';
      }>,
      metaData: unknown,
    ) => {
      try {
        const packageDatas: PackageDatas = await ipcRenderer.invoke(
          'create-package',
          directoryName,
          packageName,
          angles,
          metaData,
        );
        return packageDatas;
      } catch (error) {
        console.error('Error creating package:', error);
        throw error;
      }
    },
    saveSyncData: async (
      configPath: string,
      syncData: {
        syncOffset: number;
        isAnalyzed: boolean;
        confidenceScore?: number;
      },
    ) => {
      try {
        return await ipcRenderer.invoke('save-sync-data', configPath, syncData);
      } catch (error) {
        console.error('saveSyncData error:', error);
        return false;
      }
    },
    checkFileExists: async (filePath: string) => {
      try {
        return await ipcRenderer.invoke('check-file-exists', filePath);
      } catch (error) {
        console.error('Error checking file:', error);
        return false;
      }
    },
    readJsonFile: async (filePath: string) => {
      try {
        return await ipcRenderer.invoke('read-json-file', filePath);
      } catch (error) {
        console.error('Error reading JSON file:', error);
        throw error;
      }
    },
    setManualModeChecked: async (checked: boolean) => {
      try {
        return await ipcRenderer.invoke('set-manual-mode-checked', checked);
      } catch (error) {
        console.error('setManualModeChecked error:', error);
        return false;
      }
    },
    setLabelModeChecked: async (checked: boolean) => {
      try {
        return await ipcRenderer.invoke('set-label-mode-checked', checked);
      } catch (error) {
        console.error('setLabelModeChecked error:', error);
        return false;
      }
    },
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
    convertConfigToRelativePath: async (packagePath: string) => {
      try {
        return await ipcRenderer.invoke(
          'convert-config-to-relative-path',
          packagePath,
        );
      } catch (error) {
        console.error('convertConfigToRelativePath error:', error);
        return { success: false, error: String(error) };
      }
    },
    setWindowTitle: (title: string) => {
      ipcRenderer.send('set-window-title', title);
    },
    exportClipsWithOverlay: async (payload: unknown) => {
      try {
        return await ipcRenderer.invoke('export-clips-with-overlay', payload);
      } catch (error) {
        console.error('Error exportClipsWithOverlay:', error);
        return { success: false, error: String(error) };
      }
    },
    saveFileDialog: async (
      defaultPath: string,
      filters: { name: string; extensions: string[] }[],
    ) => {
      try {
        return await ipcRenderer.invoke('save-file-dialog', defaultPath, filters);
      } catch (error) {
        console.error('Error in saveFileDialog:', error);
        return null;
      }
    },
    openFileDialog: async (
      filters: { name: string; extensions: string[] }[],
    ) => {
      try {
        return await ipcRenderer.invoke('open-file-dialog', filters);
      } catch (error) {
        console.error('Error in openFileDialog:', error);
        return null;
      }
    },
    openDashboardPackageDialog: async (
      filters: { name: string; extensions: string[] }[],
    ) => {
      try {
        return await ipcRenderer.invoke(
          'analysis-dashboard:open-package-dialog',
          filters,
        );
      } catch (error) {
        console.error('Error in openDashboardPackageDialog:', error);
        return null;
      }
    },
    saveDashboardPackage: async (packagePath: string, content: string) => {
      try {
        return await ipcRenderer.invoke(
          'analysis-dashboard:save-package',
          packagePath,
          content,
        );
      } catch (error) {
        console.error('Error in saveDashboardPackage:', error);
        return false;
      }
    },
    readDashboardPackage: async (packagePath: string) => {
      try {
        return await ipcRenderer.invoke(
          'analysis-dashboard:read-package',
          packagePath,
        );
      } catch (error) {
        console.error('Error in readDashboardPackage:', error);
        return null;
      }
    },
    writeTextFile: async (filePath: string, content: string) => {
      try {
        return await ipcRenderer.invoke('write-text-file', filePath, content);
      } catch (error) {
        console.error('Error in writeTextFile:', error);
        return false;
      }
    },
    writeBinaryFile: async (filePath: string, base64Content: string) => {
      try {
        return await ipcRenderer.invoke(
          'write-binary-file',
          filePath,
          base64Content,
        );
      } catch (error) {
        console.error('Error in writeBinaryFile:', error);
        return false;
      }
    },
    captureWindowRegionAsPng: async (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      try {
        return await ipcRenderer.invoke('capture-window-region-png', rect);
      } catch (error) {
        console.error('Error in captureWindowRegionAsPng:', error);
        return null;
      }
    },
    writePdfFileFromHtml: async (filePath: string, html: string) => {
      try {
        return await ipcRenderer.invoke(
          'write-pdf-file-from-html',
          filePath,
          html,
        );
      } catch (error) {
        console.error('Error in writePdfFileFromHtml:', error);
        return false;
      }
    },
    printAnalysisReportPdf: async (filePath: string, payload: unknown) => {
      try {
        return await ipcRenderer.invoke(
          'analysis-report:print-pdf',
          filePath,
          payload,
        );
      } catch (error) {
        console.error('Error in printAnalysisReportPdf:', error);
        return false;
      }
    },
    readTextFile: async (filePath: string) => {
      try {
        return await ipcRenderer.invoke('read-text-file', filePath);
      } catch (error) {
        console.error('Error in readTextFile:', error);
        return null;
      }
    },
    readBinaryFile: async (filePath: string) => {
      try {
        return await ipcRenderer.invoke('read-binary-file', filePath);
      } catch (error) {
        console.error('Error in readBinaryFile:', error);
        return null;
      }
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
      ipcRenderer.on(
        'menu-import-timeline',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
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
      ipcRenderer.on('menu-open-package', callback as unknown as () => void);
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
  } satisfies Pick<IElectronAPI, AppBridgeKeys>;

  return appBridge;
};
