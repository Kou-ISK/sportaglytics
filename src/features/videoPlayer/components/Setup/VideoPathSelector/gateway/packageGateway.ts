import type { PackageOpenProgress } from '../../../../../../types/package/openProgress';
import type { PackageDatas } from '../../../../../../renderer';
import type { VideoSyncData } from '../../../../../../types/video/sync';
import type { PackageLoadResult } from '../types';
import { buildVideoListFromConfig } from '../utils/angleUtils';

const ELECTRON_API_UNAVAILABLE = 'ELECTRON_API_UNAVAILABLE';
const PACKAGE_CONFIG_NOT_FOUND = 'PACKAGE_CONFIG_NOT_FOUND';
const PACKAGE_CONFIG_INVALID = 'PACKAGE_CONFIG_INVALID';
const PACKAGE_VIDEO_MISSING = 'PACKAGE_VIDEO_MISSING';
const PACKAGE_MIGRATION_CANCELLED = 'PACKAGE_MIGRATION_CANCELLED';
const PACKAGE_MIGRATION_FAILED = 'PACKAGE_MIGRATION_FAILED';

interface PackageTeamNames {
  team1Name: string;
  team2Name: string;
}

interface LoadedPackageData extends PackageTeamNames {
  warning?: string;
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
    angleOffsets:
      Array.isArray(value.angleOffsets) &&
      value.angleOffsets.every(
        (offset) => typeof offset === 'number' && Number.isFinite(offset),
      )
        ? value.angleOffsets
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

const normalizePackagePath = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (
    isRecord(value) &&
    typeof value.path === 'string' &&
    value.path.length > 0
  ) {
    return value.path;
  }

  return null;
};

const preparePackagePathForOpen = async (
  packagePath: string,
  requestId?: string,
): Promise<{ path: string; warning?: string }> => {
  const api = getElectronApi();
  if (!api.preparePackageForOpen) return { path: packagePath };

  const preparation = await (requestId
    ? api.preparePackageForOpen(packagePath, requestId)
    : api.preparePackageForOpen(packagePath));

  if (preparation.status !== 'ready') {
    throw new Error(PACKAGE_MIGRATION_FAILED);
  }
  return { path: preparation.packagePath, warning: preparation.warning };
};

export const pickPackagePath = async (
  preselectedPath?: unknown,
): Promise<string | null> => {
  const normalized = normalizePackagePath(preselectedPath);
  if (normalized) {
    return normalized;
  }

  const api = getElectronApi();
  const selectedPath = api.selectPackagePath
    ? await api.selectPackagePath()
    : await api.openDirectory();
  return selectedPath || null;
};

export const selectPackageDirectory = async (): Promise<string | null> => {
  const selectedPath = await getElectronApi().openDirectory();
  return selectedPath || null;
};

export const selectVideoFile = async (): Promise<string | null> => {
  const selectedPath = await getElectronApi().openFile();
  return selectedPath || null;
};

export const selectVideoFiles = async (): Promise<string[]> => {
  return await getElectronApi().openVideoFiles();
};

export const createVideoPackage = async (
  directoryName: string,
  packageName: string,
  angles: Parameters<NonNullable<Window['electronAPI']>['createPackage']>[2],
  metaDataConfig: unknown,
): Promise<PackageDatas> => {
  return await getElectronApi().createPackage(
    directoryName,
    packageName,
    angles,
    metaDataConfig,
  );
};

let latestOpen = 0;
export const loadPackageDirectory = async (
  packagePath: string,
  requestId?: string,
  isCurrent: () => boolean = () => true,
): Promise<LoadedPackageData> => {
  const generation = ++latestOpen;
  const bindingId = requestId ?? crypto.randomUUID();
  const current = (): boolean => generation === latestOpen && isCurrent();
  const api = getElectronApi();
  let preparedPackagePath = packagePath;
  try {
    const prepared = await preparePackagePathForOpen(packagePath, bindingId);
    preparedPackagePath = prepared.path;
    if (!current()) throw new Error('PACKAGE_OPEN_CANCELLED');
    const sessionBound = await api.bindPackageSession?.(
      preparedPackagePath,
      bindingId,
    );
    if (sessionBound === false)
      throw new Error('このパッケージは別のウィンドウで開かれています。');
    if (!current()) throw new Error('PACKAGE_OPEN_CANCELLED');
    const loaded = await readPreparedPackage(preparedPackagePath);
    if (!current()) throw new Error('PACKAGE_OPEN_CANCELLED');
    return {
      ...loaded,
      warning: prepared.warning,
    };
  } catch (error) {
    await releasePackageSessionReservation(preparedPackagePath, bindingId);
    if (preparedPackagePath !== packagePath)
      await releasePackageSessionReservation(packagePath, bindingId);
    throw error;
  }
};

const readPreparedPackage = async (
  preparedPackagePath: string,
): Promise<LoadedPackageData> => {
  const api = getElectronApi();
  const configFilePath = `${preparedPackagePath}/.metadata/config.json`;

  const exists = await api.checkFileExists?.(configFilePath);
  if (!exists) {
    throw new Error(PACKAGE_CONFIG_NOT_FOUND);
  }

  const config = await api.readJsonFile(configFilePath);
  if (!isRecord(config)) {
    throw new Error(PACKAGE_CONFIG_INVALID);
  }

  const { videoList, angles } = buildVideoListFromConfig(
    config,
    preparedPackagePath,
  );
  if (videoList.length === 0) {
    throw new Error(PACKAGE_VIDEO_MISSING);
  }

  const supportsAudioSync = angles.length >= 2;
  const persistedSyncData = toSyncData(config.syncData);
  const angleOffsets = angles.map((angle) => angle.playbackOffsetSeconds);
  const hasAngleOffset = angleOffsets.some((offset) => offset !== 0);
  const syncData =
    persistedSyncData || hasAngleOffset
      ? {
          syncOffset: persistedSyncData?.syncOffset ?? 0,
          isAnalyzed: persistedSyncData?.isAnalyzed ?? true,
          confidenceScore: persistedSyncData?.confidenceScore,
          angleOffsets,
        }
      : undefined;

  return {
    packagePath: preparedPackagePath,
    configFilePath,
    team1Name: readTeamName(config.team1Name, 'Team 1'),
    team2Name: readTeamName(config.team2Name, 'Team 2'),
    missingSyncData: supportsAudioSync && !persistedSyncData,
    result: {
      videoList,
      syncData,
      timelinePath: `${preparedPackagePath}/timeline.json`,
      metaDataConfigFilePath: configFilePath,
      packagePath: preparedPackagePath,
      mediaAngles: angles.map((angle) => ({
        id: angle.id,
        playbackFormat: angle.playbackFormat,
        name: angle.name,
        sourceKind: angle.sourceKind,
        clips: angle.clips,
      })),
    },
  };
};

export const releasePackageSessionReservation = async (
  packagePath: string,
  requestId?: string,
): Promise<void> => {
  try {
    const api = getElectronApi();
    if (requestId) await api.releasePackageSession?.(packagePath, requestId);
    else await api.releasePackageSession?.(packagePath);
  } catch (error) {
    console.warn('パッケージSession予約の解放をスキップ:', error);
  }
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
): (() => void) => {
  return (
    globalThis.window.electronAPI?.onPackageDirectoryOpen?.(callback) ??
    (() => undefined)
  );
};

export const subscribeToOpenPackage = (callback: () => void): (() => void) => {
  return (
    globalThis.window.electronAPI?.onOpenPackage?.(callback) ??
    (() => undefined)
  );
};

export const subscribeToOpenRecentPackage = (
  callback: (path: string) => void,
): (() => void) => {
  return (
    globalThis.window.electronAPI?.onOpenRecentPackage?.(callback) ??
    (() => undefined)
  );
};

export const toPackageLoadErrorMessage = (error: unknown): string => {
  const errorMessage = error instanceof Error ? error.message : '';
  const errorCode =
    errorMessage.match(/\bPACKAGE_[A-Z_]+\b/)?.[0] ?? errorMessage;

  switch (errorCode) {
    case 'PACKAGE_UPDATE_BUSY':
      return '対象または以前のコピーが別のウィンドウで使用中、録画中、または更新中です。作業を保存して閉じてから再試行してください。';
    case 'PACKAGE_UPDATE_CHOICE_REQUIRED':
    case 'PACKAGE_UPDATE_COPY_DIVERGED':
      return '以前のコピーにも編集が残っています。内容を確認してから使うファイルを選んでください。どちらも削除していません。';
    case 'PACKAGE_UPDATE_RECOVERY_REQUIRED':
    case 'PACKAGE_UPDATE_BACKUP_CONFLICT':
    case 'PACKAGE_UPDATE_PATH_CONFLICT':
    case 'PACKAGE_UPDATE_RECEIPT_INVALID':
      return '更新途中のデータを保持しました。このファイルへの保存は開始していません。元の場所から再度開いて復旧を試すか、同じフォルダの作業フォルダとバックアップを保管してください。';
    case 'PACKAGE_UPDATE_BACKUP_HISTORY_INVALID':
      return '同じフォルダにあるバックアップの記録を確認できません。ファイルは変更せず、保存を開始していません。現在のファイルとバックアップを保管してください。';
    case 'PACKAGE_UPDATE_UNRELATED_COPY':
      return '選択したコピーがこのファイルに対応することを確認できませんでした。内容は変更していません。';
    case 'PACKAGE_UPDATE_REFERENCE_CONFLICT':
      return '編集したコピーが元のファイル内の映像を外部参照しています。元のファイルは変更していません。映像をコピー側にまとめてから再試行してください。';
    case 'PACKAGE_UPDATE_BACKUP_SELECTED':
      return 'これは更新前のバックアップです。対象をアプリで閉じ、現在のファイルを別の場所に保管してから、バックアップを元の場所へ戻して開いてください。';
    case 'PACKAGE_MIGRATION_DESTINATION_UNAVAILABLE':
      return '前回準備したパッケージが見つかりません。保存先のドライブを接続するか、「パッケージを開く」から移動先を選んでください。';
    case ELECTRON_API_UNAVAILABLE:
      return 'この機能はElectronアプリケーション内でのみ利用できます。';
    case PACKAGE_CONFIG_NOT_FOUND:
      return '選択したパッケージ内に .metadata/config.json が見つかりません。';
    case PACKAGE_VIDEO_MISSING:
      return 'アングルに映像が割り当てられていません。';
    case PACKAGE_CONFIG_INVALID:
      return 'パッケージ設定の読み込みに失敗しました。';
    case PACKAGE_MIGRATION_CANCELLED:
      return '開くための準備をキャンセルしました。';
    case PACKAGE_MIGRATION_FAILED:
      return 'ファイルを開くための準備に失敗しました。原本は保持されています。';
    case 'PACKAGE_VERSION_UNSUPPORTED':
      return '対応していない新しいパッケージ形式です。原本は変更していません。対応版のSporTagLyticsで開いてください。';
    case 'PACKAGE_SPORTSCODE_NATIVE_UNSUPPORTED':
      return 'Sportscodeのnativeパッケージは直接開けません。SportscodeからXMLを書き出して、新しいプロジェクトへ読み込んでください。';
    case 'PACKAGE_TIMELINE_INVALID':
      return 'タイムラインの構成・時刻・バージョンに対応していません。原本は変更していません。形式を確認してください。';
    case 'PACKAGE_MEDIA_MISSING':
      return '参照する映像が見つかりません。元の映像・外付けドライブの接続を復元して再試行してください。原本は変更していません。';
    case 'PACKAGE_MIGRATION_SPACE':
      return '移行コピーに必要な空き容量がありません。空き容量を確保して再試行してください。原本は変更していません。';
    default:
      return 'ファイルを開けませんでした。書き込み権限・空き容量・映像の場所を確認して再試行してください。更新途中の作業フォルダとバックアップは削除せず保管してください。';
  }
};

export const resolveDroppedPackagePath = (file: File): string => {
  const path =
    globalThis.window.electronAPI?.resolveDroppedPackagePath?.(file) ?? '';
  return path;
};

export const subscribeToPackageOpenProgress = (
  callback: (state: PackageOpenProgress) => void,
): (() => void) =>
  getElectronApi().onPackageOpenProgress?.(callback) ?? (() => undefined);

export const cancelPackageOpenRequest = async (
  requestId: string,
): Promise<boolean> =>
  (await getElectronApi().cancelPackageOpen?.(requestId)) ?? false;
