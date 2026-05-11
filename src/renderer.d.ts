import type { IPlaylistAPI } from './types/playlist/api';
import type { AnalysisView } from './types/analysis/view';
import type { AnalysisReportPayload } from './report/types';
import type { AppSettings } from './types/settings/coreTypes';
import type { IAnalysisWindowAPI } from './types/ipc/analysisWindow';
import type {
  ClipExportExecutionResult,
  ClipExportPayload,
} from './shared/clipExport/clipExportTypes';

export interface LlamaModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
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
  onMenuShowStats: (
    callback: (requestedView?: AnalysisView) => void,
  ) => () => void;
  onTimelineUndo: (callback: () => void) => () => void;
  onTimelineRedo: (callback: () => void) => () => void;
  onMenuExportAnalysisRawCsv: (callback: () => void) => () => void;
  onMenuShowShortcuts: (callback: () => void) => () => void;
  onMenuExportClips: (callback: () => void) => () => void;
  notifyHotkeysUpdated: () => void;
  onAnalysisReportPayload: (
    callback: (message: {
      requestId?: string;
      payload?: AnalysisReportPayload;
    }) => void,
  ) => () => void;
  notifyAnalysisReportRenderReady: (requestId: string) => void;
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
  onToggleLabelMode: (callback: (checked: boolean) => void) => () => void;
  convertConfigToRelativePath: (packagePath: string) => Promise<{
    success: boolean;
    config?: Record<string, unknown>;
    error?: string;
  }>;
  // 設定管理API
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  resetSettings: () => Promise<AppSettings>;
  onOpenSettings: (callback: () => void) => void;
  offOpenSettings: (callback: () => void) => void;
  onSettingsUpdated: (
    callback: (settings: AppSettings) => void,
  ) => (() => void) | void;
  openSettingsWindow: () => Promise<void>;
  closeSettingsWindow: () => Promise<void>;
  isSettingsWindowOpen: () => Promise<boolean>;
  analysis: IAnalysisWindowAPI;
  llama: {
    generate: (payload: {
      prompt: string;
      model: string;
      temperature?: number;
      topP?: number;
      topK?: number;
      repeatPenalty?: number;
      maxTokens?: number;
      timeoutMs?: number;
      requestId?: string;
    }) => Promise<{
      text: string;
      stderr?: string;
      binaryPath?: string;
      modelPath?: string;
      durationMs?: number;
    }>;
    cancel: (requestId: string) => Promise<boolean>;
    listModels: () => Promise<LlamaModelInfo[]>;
    onProgress: (callback: (payload: unknown) => void) => void;
    offProgress: (callback: (payload: unknown) => void) => void;
  };
  setWindowTitle: (title: string) => void;
  exportClipsWithOverlay?: (
    payload: ClipExportPayload,
  ) => Promise<ClipExportExecutionResult>;
  saveFileDialog: (
    defaultPath: string,
    filters: { name: string; extensions: string[] }[],
  ) => Promise<string | null>;
  openFileDialog: (
    filters: { name: string; extensions: string[] }[],
  ) => Promise<string | null>;
  openDashboardPackageDialog: (
    filters: { name: string; extensions: string[] }[],
  ) => Promise<string | null>;
  writeTextFile: (filePath: string, content: string) => Promise<boolean>;
  writeBinaryFile: (
    filePath: string,
    base64Content: string,
  ) => Promise<boolean>;
  captureWindowRegionAsPng: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<string | null>;
  writePdfFileFromHtml: (filePath: string, html: string) => Promise<boolean>;
  printAnalysisReportPdf: (
    filePath: string,
    payload: AnalysisReportPayload,
  ) => Promise<boolean>;
  readTextFile: (filePath: string) => Promise<string | null>;
  readBinaryFile: (filePath: string) => Promise<string | null>;
  saveDashboardPackage: (
    packagePath: string,
    content: string,
  ) => Promise<boolean>;
  readDashboardPackage: (packagePath: string) => Promise<string | null>;
  onExportTimeline: (callback: (format: string) => void) => () => void;
  onImportTimeline: (callback: () => void) => () => void;
  onCodingModeChange: (
    callback: (mode: 'code' | 'label') => void,
  ) => () => void;
  onOpenPackage: (callback: () => void) => () => void;
  onOpenRecentPackage: (callback: (path: string) => void) => () => void;
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
