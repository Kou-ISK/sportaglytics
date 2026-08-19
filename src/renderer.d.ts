import type { IPlaylistAPI } from './types/playlist/api';
import type { AnalysisView } from './types/analysis/view';
import type { AnalysisReportPayload } from './report/types';
import type { AppSettings } from './types/settings/coreTypes';
import type { IAnalysisWindowAPI } from './types/ipc/analysisWindow';
import type { ICodingPanelWindowAPI } from './types/ipc/codingPanelWindow';
import type { IEventDetectionAPI } from './types/ipc/eventDetection';
import type {
  ClipExportExecutionResult,
  ClipExportPayload,
} from './shared/clipExport/clipExportTypes';
import type { ExportProgressWindowState } from './types/ipc/exportProgressWindow';
import type { ITimelineWindowAPI } from './types/ipc/timelineWindow';
import type { PackageOpenPreparationResult } from './types/package/migration';

export interface LlamaModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
}

export interface IElectronAPI {
  openFile: () => Promise<string>;
  openVideoFiles: () => Promise<string[]>;
  resolveDroppedVideoFilePath: (file: File) => string;
  openDirectory: () => Promise<string>;
  exportTimeline: (filePath: string, source: unknown) => Promise<void>;
  createPackage: (
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
        timelineStartSeconds?: number;
        durationSeconds?: number;
      }>;
      role?: 'primary' | 'secondary';
    }>,
    metaDataConfig: unknown,
  ) => Promise<PackageDatas>;
  preparePackageForOpen?: (
    packagePath: string,
    destinationPath?: string,
  ) => Promise<PackageOpenPreparationResult>;
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
  onResyncAudio: (callback: () => void) => void;
  onResetSync: (callback: () => void) => void;
  onManualSync: (callback: () => void) => void;
  offResyncAudio: (callback: () => void) => void;
  offResetSync: (callback: () => void) => void;
  offManualSync: (callback: () => void) => void;
  onSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => void;
  offSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => void;
  checkFileExists: (filePath: string) => Promise<boolean>;
  readJsonFile: (filePath: string) => Promise<unknown>;
  saveSyncData: (
    configPath: string,
    syncData: {
      syncOffset: number;
      isAnalyzed: boolean;
      confidenceScore?: number;
      angleOffsets?: number[];
    },
  ) => Promise<boolean>;
  applyClipTimeline: (
    configPath: string,
    placements: Array<{
      clipId: string;
      timelineStartSeconds: number;
      durationSeconds?: number;
    }>,
  ) => Promise<PackageDatas>;
  extractLocalAudioWindow: (
    videoPath: string,
    startSeconds: number,
    durationSeconds: number,
  ) => Promise<string | null>;
  beginLoopbackAudioCapture: () => Promise<boolean>;
  endLoopbackAudioCapture: () => Promise<void>;
  extractAudioWavForSync: (videoPath: string) => Promise<string | null>;
  setManualModeChecked: (checked: boolean) => Promise<boolean>;
  convertConfigToRelativePath: (packagePath: string) => Promise<{
    success: boolean;
    config?: Record<string, unknown>;
    error?: string;
  }>;
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
  codingPanelWindow: ICodingPanelWindowAPI;
  timelineWindow: ITimelineWindowAPI;
  eventDetection: IEventDetectionAPI;
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
  onExportProgressWindowState?: (
    callback: (state: ExportProgressWindowState) => void,
  ) => () => void;
  requestExportProgressWindowState?: () => Promise<ExportProgressWindowState | null>;
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
  onOpenCodeWindowFile: (callback: () => void) => () => void;
  onCreateCodeWindowFile: (callback: () => void) => () => void;
  onCreateVideoPackage: (callback: () => void) => () => void;
  onOpenPackage: (callback: () => void) => () => void;
  onOpenRecentPackage: (callback: (path: string) => void) => () => void;
  updateRecentPackages: (paths: string[]) => void;
  playlist: IPlaylistAPI;
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
    relativePath?: string;
    sourceKind: 'local' | 'youtube';
    sourceUrl?: string;
    clips: Array<{
      id: string;
      sourceKind: 'local' | 'youtube';
      absolutePath?: string;
      relativePath?: string;
      sourceUrl?: string;
      gapBeforeSeconds: number;
      timelineStartSeconds?: number;
      durationSeconds?: number;
    }>;
  }>;
  metaDataConfigFilePath: string;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
