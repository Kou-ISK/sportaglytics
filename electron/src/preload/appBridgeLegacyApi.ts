import type { IpcRenderer } from 'electron';
import type { IElectronAPI, PackageDatas } from '../../../src/renderer';
import { invokeWithFallback } from './appBridge.compat';

export type AppBridgeLegacyKeys =
  | 'openFile'
  | 'openDirectory'
  | 'exportTimeline'
  | 'createPackage'
  | 'saveSyncData'
  | 'checkFileExists'
  | 'readJsonFile'
  | 'setManualModeChecked'
  | 'setLabelModeChecked'
  | 'convertConfigToRelativePath';

export const createAppBridgeLegacyApi = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, AppBridgeLegacyKeys> => {
  return {
    openFile: async () => {
      try {
        const filePath = await invokeWithFallback<string>(
          ipcRenderer,
          'files:open-video-file',
          'open-file',
        );
        return filePath ?? '';
      } catch (error) {
        console.error('Error:', error);
        return '';
      }
    },
    openDirectory: async () => {
      try {
        const filePath = await invokeWithFallback<string>(
          ipcRenderer,
          'files:open-directory',
          'open-directory',
        );
        return filePath ?? '';
      } catch (error) {
        console.error('Error:', error);
        return '';
      }
    },
    exportTimeline: async (filePath: string, source: unknown) => {
      try {
        await invokeWithFallback<void>(
          ipcRenderer,
          'timeline:export-json',
          'export-timeline',
          filePath,
          source,
        );
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
        const packageDatas = await invokeWithFallback<PackageDatas>(
          ipcRenderer,
          'package:create',
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
        return await invokeWithFallback<boolean>(
          ipcRenderer,
          'sync:save-data',
          'save-sync-data',
          configPath,
          syncData,
        );
      } catch (error) {
        console.error('saveSyncData error:', error);
        return false;
      }
    },
    checkFileExists: async (filePath: string) => {
      try {
        return await invokeWithFallback<boolean>(
          ipcRenderer,
          'files:exists',
          'check-file-exists',
          filePath,
        );
      } catch (error) {
        console.error('Error checking file:', error);
        return false;
      }
    },
    readJsonFile: async (filePath: string) => {
      try {
        return await invokeWithFallback<unknown>(
          ipcRenderer,
          'files:read-json',
          'read-json-file',
          filePath,
        );
      } catch (error) {
        console.error('Error reading JSON file:', error);
        throw error;
      }
    },
    setManualModeChecked: async (checked: boolean) => {
      try {
        return await invokeWithFallback<boolean>(
          ipcRenderer,
          'menu:set-manual-mode-checked',
          'set-manual-mode-checked',
          checked,
        );
      } catch (error) {
        console.error('setManualModeChecked error:', error);
        return false;
      }
    },
    setLabelModeChecked: async (checked: boolean) => {
      try {
        return await invokeWithFallback<boolean>(
          ipcRenderer,
          'menu:set-label-mode-checked',
          'set-label-mode-checked',
          checked,
        );
      } catch (error) {
        console.error('setLabelModeChecked error:', error);
        return false;
      }
    },
    convertConfigToRelativePath: async (packagePath: string) => {
      try {
        return await invokeWithFallback<{
          success: boolean;
          config?: Record<string, unknown>;
          error?: string;
        }>(
          ipcRenderer,
          'package:convert-config-to-relative-path',
          'convert-config-to-relative-path',
          packagePath,
        );
      } catch (error) {
        console.error('convertConfigToRelativePath error:', error);
        return { success: false, error: String(error) };
      }
    },
  };
};
