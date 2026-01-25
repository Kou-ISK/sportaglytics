import type { IPlaylistAPI } from './types/Playlist';
import type { TimelineData } from './types/TimelineData';
import type { AnalysisView } from './features/videoPlayer/components/Analytics/AnalysisPanel/AnalysisPanel';

export interface AnalysisWindowSyncPayload {
  timeline: TimelineData[];
  teamNames: string[];
  view?: AnalysisView;
}

export interface IElectronAPI {
  openFile: () => Promise<string>;
  openDirectory: () => Promise<string>;
  exportTimeline: (filePath: string, source: unknown) => Promise<void>;
  createPackage: (
    directoryName: string,
    packageName: string,
    angles: Array<{
      id: string;
      name: string;
      sourcePath: string;
      role?: 'primary' | 'secondary';
    }>,
    metaDataConfig: unknown,
  ) => Promise<PackageDatas>;
  on: (
    channel: string,
    listener: (event: unknown, args: unknown) => void,
  ) => void;
  off: (channel: string, listener: (...args: unknown[]) => void) => void; // 追加
  // メニューからの音声同期イベント
  onResyncAudio: (callback: () => void) => void;
  onResetSync: (callback: () => void) => void;
  onManualSync: (callback: () => void) => void; // 追加
  offResyncAudio: (callback: () => void) => void; // 追加
  offResetSync: (callback: () => void) => void; // 追加
  offManualSync: (callback: () => void) => void; // 追加
  onSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => void; // 追加
  offSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => void; // 追加
  // ファイル存在確認
  checkFileExists: (filePath: string) => Promise<boolean>;
  // JSONファイル読み込み
  readJsonFile: (filePath: string) => Promise<unknown>;
  saveSyncData: (
    configPath: string,
    syncData: {
      syncOffset: number;
      isAnalyzed: boolean;
      confidenceScore?: number;
    },
  ) => Promise<boolean>;
  setManualModeChecked: (checked: boolean) => Promise<boolean>;
  setLabelModeChecked: (checked: boolean) => Promise<boolean>;
  onToggleLabelMode: (callback: (checked: boolean) => void) => void;
  convertConfigToRelativePath: (packagePath: string) => Promise<{
    success: boolean;
    config?: Record<string, unknown>;
    error?: string;
  }>;
  // 設定管理API
  loadSettings: () => Promise<unknown>;
  saveSettings: (settings: unknown) => Promise<boolean>;
  send: (channel: string) => void;
  resetSettings: () => Promise<unknown>;
  onOpenSettings: (callback: () => void) => void;
  offOpenSettings: (callback: () => void) => void;
  onSettingsUpdated: (
    callback: (settings: import('./types/Settings').AppSettings) => void,
  ) => (() => void) | void;
  openSettingsWindow: () => Promise<void>;
  closeSettingsWindow: () => Promise<void>;
  isSettingsWindowOpen: () => Promise<boolean>;
  analysis: {
    openWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    isWindowOpen: () => Promise<boolean>;
    syncToWindow: (payload: AnalysisWindowSyncPayload) => void;
    onSync: (callback: (payload: AnalysisWindowSyncPayload) => void) => void;
    offSync: (callback: (payload: AnalysisWindowSyncPayload) => void) => void;
    sendJumpToSegment: (segment: TimelineData) => void;
  };
  setWindowTitle: (title: string) => void;
  exportClipsWithOverlay?: (payload: {
    sourcePath: string;
    sourcePath2?: string;
    mode?: 'single' | 'dual';
    exportMode?: 'single' | 'perInstance' | 'perRow';
    angleOption?: 'allAngles' | 'single' | 'multi';
    outputDir?: string;
    outputFileName?: string;
    clips: Array<{
      id: string;
      actionName: string;
      startTime: number;
      endTime: number;
      freezeAt?: number | null;
      freezeDuration?: number;
      labels?: { group: string; name: string }[];
      memo?: string;
      actionIndex?: number;
      annotationPngPrimary?: string | null;
      annotationPngSecondary?: string | null;
    }>;
    overlay: {
      enabled: boolean;
      showActionName: boolean;
      showActionIndex: boolean;
      showLabels: boolean;
      showMemo: boolean;
    };
  }) => Promise<{ success: boolean; error?: string }>;
  saveFileDialog: (
    defaultPath: string,
    filters: { name: string; extensions: string[] }[],
  ) => Promise<string | null>;
  openFileDialog: (
    filters: { name: string; extensions: string[] }[],
  ) => Promise<string | null>;
  writeTextFile: (filePath: string, content: string) => Promise<boolean>;
  readTextFile: (filePath: string) => Promise<string | null>;
  onExportTimeline: (callback: (format: string) => void) => void;
  onImportTimeline: (callback: () => void) => void;
  onCodingModeChange: (callback: (mode: 'code' | 'label') => void) => void;
  onOpenPackage: (callback: () => void) => void;
  onOpenRecentPackage: (callback: (path: string) => void) => void;
  updateRecentPackages: (paths: string[]) => void;
  // プレイリストAPI
  playlist: IPlaylistAPI;
  // コードウィンドウファイルAPI
  codeWindow: {
    saveFile: (
      codeWindow: unknown,
      filePath?: string,
    ) => Promise<string | null>;
    loadFile: (
      filePath?: string,
    ) => Promise<{ codeWindow: unknown; filePath: string } | null>;
    onExternalOpen: (callback: (filePath: string) => void) => () => void;
    peekExternalOpen: () => Promise<string | null>;
    consumeExternalOpen: (expectedPath?: string) => Promise<string | null>;
  };
  // パッケージディレクトリが外部から開かれたときの通知
  onPackageDirectoryOpen: (callback: (dirPath: string) => void) => () => void;
}

export interface PackageDatas {
  timelinePath: string;
  tightViewPath: string;
  wideViewPath: string | null;
  angles: Array<{
    id: string;
    name: string;
    role?: 'primary' | 'secondary';
    absolutePath: string;
    relativePath: string;
  }>;
  metaDataConfigFilePath: string;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
