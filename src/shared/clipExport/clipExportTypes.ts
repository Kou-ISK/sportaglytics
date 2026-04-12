export type ClipExportScope = 'all' | 'selected';
export type ClipExportMode = 'single' | 'perInstance' | 'perRow';
export type ClipExportAngleOption = 'allAngles' | 'single' | 'multi';
export type ClipExportAngleType = 'angle1' | 'angle2';

export interface ClipExportLabel {
  group: string;
  name: string;
}

export interface ClipExportOverlaySettings {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
}

export const DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS: ClipExportOverlaySettings = {
  enabled: true,
  showActionName: true,
  showActionIndex: true,
  showLabels: true,
  showMemo: true,
};

export interface ClipExportItem {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  freezeAt?: number | null;
  freezeDuration?: number;
  labels?: ClipExportLabel[];
  memo?: string;
  actionIndex?: number;
  annotationPngPrimary?: string | null;
  annotationPngSecondary?: string | null;
  videoSource?: string;
  videoSource2?: string;
  angleType?: ClipExportAngleType;
}

export interface ClipExportPayload {
  sourcePath: string;
  sourcePath2?: string;
  mode?: 'single' | 'dual';
  exportMode?: ClipExportMode;
  angleOption?: 'all' | ClipExportAngleType | ClipExportAngleOption;
  outputDir?: string;
  outputFileName?: string;
  clips: ClipExportItem[];
  overlay: ClipExportOverlaySettings;
}

export interface ClipExportExecutionResult {
  success: boolean;
  error?: string;
}

export interface ClipExportSourceSelection {
  sourcePath?: string;
  sourcePath2?: string;
}

export interface ClipExportProgressState {
  current: number;
  total: number;
  message: string;
}

export type ClipExportExecutor = (
  payload: ClipExportPayload,
) => Promise<ClipExportExecutionResult>;
