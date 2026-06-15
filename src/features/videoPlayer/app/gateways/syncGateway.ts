import type { VideoSyncData } from '../../../../types/video/sync';

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const saveSyncData = async (
  metaDataConfigFilePath: string,
  syncData: VideoSyncData,
): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.saveSyncData || !metaDataConfigFilePath) {
    return false;
  }

  try {
    return await api.saveSyncData(metaDataConfigFilePath, syncData);
  } catch (error: unknown) {
    console.debug('[syncGateway] saveSyncData failed', error);
    return false;
  }
};

export const setManualSyncModeChecked = async (
  checked: boolean,
): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.setManualModeChecked) {
    return false;
  }

  try {
    return await api.setManualModeChecked(checked);
  } catch (error: unknown) {
    console.debug('[syncGateway] setManualModeChecked failed', error);
    return false;
  }
};

export const readBinaryFileBase64 = async (
  filePath: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.readBinaryFile) {
    return null;
  }

  try {
    return await api.readBinaryFile(filePath);
  } catch (error: unknown) {
    console.debug('[syncGateway] readBinaryFile failed', error);
    return null;
  }
};

export const extractAudioWavForSyncBase64 = async (
  videoPath: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.extractAudioWavForSync) {
    return null;
  }

  try {
    return await api.extractAudioWavForSync(videoPath);
  } catch (error: unknown) {
    console.debug('[syncGateway] extractAudioWavForSync failed', error);
    return null;
  }
};
