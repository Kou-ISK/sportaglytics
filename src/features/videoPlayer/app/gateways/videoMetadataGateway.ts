import type { VideoSyncData } from '../../../../types/video/sync';

interface TeamMetadata {
  team1Name: string;
  team2Name: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const saveVideoMetadataSyncData = async (
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
    console.debug('[videoMetadataGateway] saveSyncData failed', error);
    return false;
  }
};

export const readVideoMetadataPackageName = async (
  metaDataConfigFilePath: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.readJsonFile || !metaDataConfigFilePath) {
    return null;
  }

  try {
    const config = await api.readJsonFile(metaDataConfigFilePath);
    if (!isRecord(config) || typeof config.packageName !== 'string') {
      return null;
    }

    return config.packageName || null;
  } catch (error: unknown) {
    console.debug('[videoMetadataGateway] read package name failed', error);
    return null;
  }
};

export const readVideoMetadataTeamNames = async (
  metaDataConfigFilePath: string,
): Promise<TeamMetadata | null> => {
  const api = getElectronApi();
  if (!api?.readJsonFile || !metaDataConfigFilePath) {
    return null;
  }

  try {
    const config = await api.readJsonFile(metaDataConfigFilePath);
    if (
      !isRecord(config) ||
      typeof config.team1Name !== 'string' ||
      typeof config.team2Name !== 'string'
    ) {
      return null;
    }

    return {
      team1Name: config.team1Name,
      team2Name: config.team2Name,
    };
  } catch (error: unknown) {
    console.debug('[videoMetadataGateway] read team names failed', error);
    return null;
  }
};

export const setVideoWindowTitle = (title: string): void => {
  getElectronApi()?.setWindowTitle?.(title);
};
