import type { MatrixAxisConfig } from '../types/MatrixConfig';
import type { MomentumSegment } from '../types/Analysis';
import type {
  AnalysisDashboardConfig,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesFilter,
} from '../types/Settings';
import type { TimelineData } from '../types/TimelineData';
import type { MatrixFilterState } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/hooks/matrixFilterUtils';

export interface AnalysisReportMeta {
  generatedAt: string;
  playlistName?: string;
  matchName?: string;
  teamName?: string;
  filtersSummary?: string;
  timelineCount: number;
  timelineSpanSec: number;
}

export interface AnalysisReportCard {
  title: string;
  value: string;
  subValue?: string;
}

export type ReportChartDatumValue = number | string | string[];

export interface DashboardChartWidgetReportData {
  kind: 'chart';
  id: string;
  title: string;
  colSpan: 4 | 6 | 12;
  chartType: DashboardChartType;
  metric: DashboardMetric;
  calcMode: DashboardCalcMode;
  unitLabel: string;
  seriesKeys: string[];
  data: Array<Record<string, ReportChartDatumValue>>;
  hasData: boolean;
  showLegend: boolean;
}

export type DashboardWidgetReportData = DashboardChartWidgetReportData;

export interface DashboardReportPage {
  pageIndex: number;
  rowCount: number;
  widgets: DashboardWidgetReportData[];
}

export interface AnalysisReportDashboard {
  title: string;
  activeDashboardName?: string;
  cards: AnalysisReportCard[];
  widgets: DashboardWidgetReportData[];
  pages: DashboardReportPage[];
  filtersSummary: string;
}

export interface AnalysisReportMomentum {
  title: string;
  segments: MomentumSegment[];
  maxAbs: number;
  teamNames: string[];
  summary?: string;
  hasData: boolean;
  outcomeCounts: {
    Try: number;
    Positive: number;
    Negative: number;
    Neutral: number;
  };
}

export interface AnalysisReportMatrixSection {
  title: string;
  filterKey: string;
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Array<{ key: string; span: number }>;
  colParentSpans: Array<{ key: string; span: number }>;
  values: number[][];
  visibleCount: number;
  totalCount: number;
  isOthersBucket: boolean;
}

export interface AnalysisReportMatrix {
  title: string;
  axes: { row: string; column: string };
  filterSummary: string;
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Array<{ key: string; span: number }>;
  colParentSpans: Array<{ key: string; span: number }>;
  values: number[][];
  visibleCount: number;
  totalCount: number;
  sections: AnalysisReportMatrixSection[];
  referenceNote: string;
  min?: number;
  max?: number;
}

export interface AnalysisReportData {
  meta: AnalysisReportMeta;
  dashboard: AnalysisReportDashboard;
  momentum: AnalysisReportMomentum;
  matrix: AnalysisReportMatrix;
  notes?: string;
}

export interface AnalysisReportBuildContext {
  timeline: TimelineData[];
  resolvedTeamNames: string[];
  currentDashboardFilters: DashboardSeriesFilter;
  currentMatrixAxes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  };
  currentMatrixFilters: MatrixFilterState;
  analysisDashboard?: AnalysisDashboardConfig;
}

export type AnalysisReportPayload = AnalysisReportData;
