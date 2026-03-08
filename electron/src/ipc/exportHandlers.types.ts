export interface ClipLabel {
  group: string;
  name: string;
}

export interface ClipExportItem {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  freezeAt?: number | null;
  freezeDuration?: number;
  labels?: ClipLabel[];
  memo?: string;
  actionIndex?: number;
  annotationPngPrimary?: string | null;
  annotationPngSecondary?: string | null;
  videoSource?: string;
  videoSource2?: string;
  angleType?: 'angle1' | 'angle2';
}

export interface ExportOverlayOptions {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
  textTemplate: string;
}

export interface ExportClipsPayload {
  sourcePath: string;
  sourcePath2?: string;
  mode?: 'single' | 'dual';
  exportMode?: 'single' | 'perInstance' | 'perRow';
  angleOption?: 'all' | 'angle1' | 'angle2' | 'allAngles' | 'single' | 'multi';
  outputDir?: string;
  outputFileName?: string;
  clips: ClipExportItem[];
  overlay: ExportOverlayOptions;
}
