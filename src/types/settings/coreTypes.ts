export interface ActionGroup {
  groupName: string;
  options: string[];
}

export interface ActionDefinition {
  action: string;
  results: string[];
  types: string[];
  groups?: ActionGroup[];
  hotkey?: string;
}

export interface HotkeyConfig {
  id: string;
  label: string;
  key: string;
  disabled?: boolean;
}

export interface CodeWindowButton {
  id: string;
  type: 'action' | 'label';
  name: string;
  labelValue?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  borderRadius?: number;
  hotkey?: string;
  team?: 'team1' | 'team2' | 'shared';
  groupId?: string;
  fontSize?: number;
}

export interface ButtonLink {
  id: string;
  fromButtonId: string;
  toButtonId: string;
  type: 'exclusive' | 'deactivate' | 'activate' | 'sequence';
}

export interface ActionLink {
  id: string;
  from: string;
  to: string;
  type: 'exclusive' | 'deactivate' | 'activate';
  description?: string;
}

export interface TeamArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CodeWindowLayout {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  buttons: CodeWindowButton[];
  buttonLinks?: ButtonLink[];
  splitByTeam?: boolean;
  team1Area?: TeamArea;
  team2Area?: TeamArea;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type DashboardMetric = 'count' | 'duration';
export type DashboardChartType = 'bar' | 'stacked' | 'pie';
export type DashboardCalcMode = 'raw' | 'percentTotal' | 'difference';
export type DashboardAnalysisMode =
  | 'standard'
  | 'trend'
  | 'histogram'
  | 'rolling'
  | 'outlier';

export interface DashboardSeriesFilter {
  team?: string;
  teamRole?: 'team1' | 'team2';
  action?: string;
  labelGroup?: string;
  labelValue?: string;
}

export interface DashboardSeriesDefinition {
  id: string;
  name: string;
  filters: DashboardSeriesFilter;
}

export interface AnalysisDashboardWidget {
  id: string;
  title: string;
  chartType: DashboardChartType;
  metric: DashboardMetric;
  analysisMode?: DashboardAnalysisMode;
  primaryAxis: import('../analysis/matrix').MatrixAxisConfig;
  seriesEnabled: boolean;
  seriesAxis: import('../analysis/matrix').MatrixAxisConfig;
  colSpan: 4 | 6 | 12;
  limit?: number;
  dataMode?: 'axis' | 'series';
  series?: DashboardSeriesDefinition[];
  calc?: DashboardCalcMode;
  widgetFilters?: DashboardSeriesFilter;
  timeBucketSec?: number;
  histogramBinSec?: number;
  rollingWindow?: number;
  outlierIqrMultiplier?: number;
}

export interface AnalysisDashboard {
  id: string;
  name: string;
  widgets: AnalysisDashboardWidget[];
}

export interface AnalysisDashboardConfig {
  dashboards: AnalysisDashboard[];
  activeDashboardId: string;
}

export interface AIAnalysisSettings {
  provider: 'llama.cpp';
  baseUrl: string;
  model: string;
  temperature: number;
  topK: number;
  embeddingEnabled: boolean;
  teamLabelGroup?: string;
  retrieverPreset?: 'balanced' | 'labels' | 'memo' | 'time';
}

export interface AppSettings {
  themeMode: ThemeMode;
  hotkeys: HotkeyConfig[];
  language: string;
  overlayClip: {
    enabled: boolean;
    showActionName: boolean;
    showActionIndex: boolean;
    showLabels: boolean;
    showMemo: boolean;
  };
  codingPanel?: {
    defaultMode: 'code' | 'label';
    toolbars: Array<{
      id: string;
      label: string;
      mode: 'code' | 'label';
      enabled: boolean;
      plugin?: 'matrix' | 'script' | 'organizer';
    }>;
    actionLinks?: ActionLink[];
    codeWindows?: CodeWindowLayout[];
    activeCodeWindowId?: string;
  };
  analysisDashboard?: AnalysisDashboardConfig;
  aiAnalysis?: AIAnalysisSettings;
}
