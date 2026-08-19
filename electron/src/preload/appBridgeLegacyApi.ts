import type { IpcRenderer } from 'electron';
import type { IElectronAPI, PackageDatas } from '../../../src/renderer';
import type { PackageOpenPreparationResult } from '../../../src/types/package/migration';
import { isStringArray } from '../../../src/types/ipc/shared';
import { invokeWithFallback } from './appBridge.compat';

export type AppBridgeLegacyKeys =
  | 'openFile'
  | 'openVideoFiles'
  | 'openDirectory'
  | 'exportTimeline'
  | 'createPackage'
  | 'preparePackageForOpen'
  | 'saveSyncData'
  | 'extractAudioWavForSync'
  | 'extractLocalAudioWindow'
  | 'applyClipTimeline'
  | 'beginLoopbackAudioCapture'
  | 'endLoopbackAudioCapture'
  | 'checkFileExists'
  | 'readJsonFile'
  | 'setManualModeChecked'
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
    openVideoFiles: async () => {
      try {
        const paths: unknown = await ipcRenderer.invoke(
          'files:open-video-files',
        );
        return isStringArray(paths) ? paths : [];
      } catch (error) {
        console.error('Error selecting video files:', error);
        return [];
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
        clips: Array<{
          id: string;
          sourceKind: 'local' | 'youtube';
          source: string;
          gapBeforeSeconds: number;
        }>;
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
    preparePackageForOpen: async (
      packagePath: string,
      destinationPath?: string,
    ): Promise<PackageOpenPreparationResult> => {
      return ipcRenderer.invoke(
        'package:prepare-open',
        packagePath,
        destinationPath,
      );
    },
    saveSyncData: async (
      configPath: string,
      syncData: {
        syncOffset: number;
        isAnalyzed: boolean;
        confidenceScore?: number;
        angleOffsets?: number[];
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
    extractAudioWavForSync: async (videoPath: string) => {
      try {
        return await invokeWithFallback<string | null>(
          ipcRenderer,
          'sync:extract-audio-wav',
          'extract-audio-wav-for-sync',
          videoPath,
        );
      } catch (error) {
        console.error('extractAudioWavForSync error:', error);
        return null;
      }
    },
    extractLocalAudioWindow: async (
      videoPath: string,
      startSeconds: number,
      durationSeconds: number,
    ) => {
      try {
        return await ipcRenderer.invoke(
          'sync:extract-audio-window',
          videoPath,
          startSeconds,
          durationSeconds,
        );
      } catch (error) {
        console.error('extractLocalAudioWindow error:', error);
        return null;
      }
    },
    applyClipTimeline: async (configPath, placements) => {
      return ipcRenderer.invoke(
        'package:apply-clip-timeline',
        configPath,
        placements,
      );
    },
    beginLoopbackAudioCapture: async () => {
      return ipcRenderer.invoke('sync:begin-loopback-audio-capture');
    },
    endLoopbackAudioCapture: async () => {
      await ipcRenderer.invoke('sync:end-loopback-audio-capture');
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
