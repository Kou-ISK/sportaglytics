export interface IElectronAPI {
  openFile: () => Promise<string>;
  openDirectory: () => Promise<string>;
  exportTimeline: (filePath: string, source: unknown) => Promise<void>;
  createPackage: (
    directoryName: string,
    packageName: string,
    tightViewPath: string,
    wideViewPath: string | null,
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
  setWindowTitle: (title: string) => void;
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
}

export interface PackageDatas {
  timelinePath: string;
  tightViewPath: string;
  wideViewPath: string | null;
  metaDataConfigFilePath: string;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
