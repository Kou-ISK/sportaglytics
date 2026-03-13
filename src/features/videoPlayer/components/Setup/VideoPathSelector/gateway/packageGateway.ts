import type { VideoSyncData } from '../../../../../../types/VideoSync';
import type { PackageLoadResult } from '../types';
import { buildVideoListFromConfig } from '../utils/angleUtils';

const ELECTRON_API_UNAVAILABLE = 'ELECTRON_API_UNAVAILABLE';
const PACKAGE_CONFIG_NOT_FOUND = 'PACKAGE_CONFIG_NOT_FOUND';
const PACKAGE_CONFIG_INVALID = 'PACKAGE_CONFIG_INVALID';
const PACKAGE_VIDEO_MISSING = 'PACKAGE_VIDEO_MISSING';

interface PackageTeamNames {
  team1Name: string;
  team2Name: string;
}

export interface LoadedPackageData extends PackageTeamNames {
  configFilePath: string;
  packagePath: string;
  missingSyncData: boolean;
  result: PackageLoadResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const readTeamName = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const toSyncData = (value: unknown): VideoSyncData | undefined => {
  if (!isRecord(value) || typeof value.syncOffset !== 'number') {
    return undefined;
  }

  return {
    syncOffset: value.syncOffset,
    isAnalyzed: Boolean(value.isAnalyzed),
    confidenceScore:
      typeof value.confidenceScore === 'number'
        ? value.confidenceScore
        : undefined,
  };
};

const getElectronApi = (): NonNullable<Window['electronAPI']> => {
  const api = globalThis.window.electronAPI;
  if (!api) {
    throw new Error(ELECTRON_API_UNAVAILABLE);
  }

  return api;
};

export const normalizePackagePath = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (isRecord(value) && typeof value.path === 'string' && value.path.length > 0) {
    return value.path;
  }

  return null;
};

export const pickPackagePath = async (
  preselectedPath?: unknown,
): Promise<string | null> => {
  const normalized = normalizePackagePath(preselectedPath);
  if (normalized) {
    return normalized;
  }

  const selectedPath = await getElectronApi().openDirectory();
  return selectedPath || null;
};

export const loadPackageDirectory = async (
  packagePath: string,
): Promise<LoadedPackageData> => {
  const api = getElectronApi();
  const configFilePath = `${packagePath}/.metadata/config.json`;

  if (api.convertConfigToRelativePath) {
    try {
      await api.convertConfigToRelativePath(packagePath);
    } catch (error) {
      console.warn('config.json変換をスキップ:', error);
    }
  }

  const exists = await api.checkFileExists?.(configFilePath);
  if (!exists) {
    throw new Error(PACKAGE_CONFIG_NOT_FOUND);
  }

  const config = await api.readJsonFile(configFilePath);
  if (!isRecord(config)) {
    throw new Error(PACKAGE_CONFIG_INVALID);
  }

  const { videoList } = buildVideoListFromConfig(config, packagePath);
  if (videoList.length === 0) {
    throw new Error(PACKAGE_VIDEO_MISSING);
  }

  const syncData = videoList.length >= 2 ? toSyncData(config.syncData) : undefined;

  return {
    packagePath,
    configFilePath,
    team1Name: readTeamName(config.team1Name, 'Team 1'),
    team2Name: readTeamName(config.team2Name, 'Team 2'),
    missingSyncData: videoList.length >= 2 && !syncData,
    result: {
      videoList,
      syncData,
      timelinePath: `${packagePath}/timeline.json`,
      metaDataConfigFilePath: configFilePath,
      packagePath,
    },
  };
};

export const readPackageTeamNames = async (
  metaDataConfigFilePath: string,
): Promise<PackageTeamNames | null> => {
  const api = globalThis.window.electronAPI;
  if (!api?.readJsonFile) {
    return null;
  }

  const config = await api.readJsonFile(metaDataConfigFilePath);
  if (!isRecord(config)) {
    return null;
  }

  return {
    team1Name: readTeamName(config.team1Name, 'Team 1'),
    team2Name: readTeamName(config.team2Name, 'Team 2'),
  };
};

export const subscribeToPackageDirectoryOpen = (
  callback: (dirPath: string) => void,
): (() => void) | undefined =>
  globalThis.window.electronAPI?.onPackageDirectoryOpen?.(callback);

export const subscribeToOpenPackage = (callback: () => void): void => {
  globalThis.window.electronAPI?.onOpenPackage?.(callback);
};

export const subscribeToOpenRecentPackage = (
  callback: (path: string) => void,
): void => {
  globalThis.window.electronAPI?.onOpenRecentPackage?.(callback);
};

export const toPackageLoadErrorMessage = (error: unknown): string => {
  const errorCode = error instanceof Error ? error.message : '';

  switch (errorCode) {
    case ELECTRON_API_UNAVAILABLE:
      return 'この機能はElectronアプリケーション内でのみ利用できます。';
    case PACKAGE_CONFIG_NOT_FOUND:
      return '選択したパッケージ内に .metadata/config.json が見つかりません。';
    case PACKAGE_VIDEO_MISSING:
      return 'アングルに映像が割り当てられていません。';
    case PACKAGE_CONFIG_INVALID:
      return 'パッケージ設定の読み込みに失敗しました。';
    default:
      return 'パッケージの読み込み中にエラーが発生しました。';
  }
};
