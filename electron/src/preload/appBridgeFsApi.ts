import type { IpcRenderer } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';

export type AppBridgeFsKeys =
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
  | 'readBinaryFile';

export const createAppBridgeFsApi = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, AppBridgeFsKeys> => {
  return {
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
    openFileDialog: async (filters: { name: string; extensions: string[] }[]) => {
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
        return await ipcRenderer.invoke('write-binary-file', filePath, base64Content);
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
        return await ipcRenderer.invoke('write-pdf-file-from-html', filePath, html);
      } catch (error) {
        console.error('Error in writePdfFileFromHtml:', error);
        return false;
      }
    },
    printAnalysisReportPdf: async (filePath: string, payload: unknown) => {
      try {
        return await ipcRenderer.invoke('analysis-report:print-pdf', filePath, payload);
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
  };
};
