import type { MatrixAxisConfig } from '../../types/analysis/matrix';
import type { TimelineData } from '../../types/timeline/core';
import type {
  DashboardAnalysisMode,
  DashboardSeriesFilter,
} from '../../types/settings/coreTypes';

export type DashboardMetric = 'count' | 'duration';
export type DashboardCalcMode = 'raw' | 'percentTotal' | 'difference';

export interface DashboardSeriesDefinition {
  id: string;
  name: string;
  filters: DashboardSeriesFilter;
}

export interface CustomChartConfig {
  primaryAxis: MatrixAxisConfig;
  seriesAxis: MatrixAxisConfig;
  seriesEnabled: boolean;
  metric: DashboardMetric;
  analysisMode?: DashboardAnalysisMode;
  limit?: number;
  series?: DashboardSeriesDefinition[];
  calc?: DashboardCalcMode;
  baseFilters?: DashboardSeriesFilter;
  widgetFilters?: DashboardSeriesFilter;
  teamRoleMap?: { team1?: string; team2?: string };
  timeBucketSec?: number;
  histogramBinSec?: number;
  rollingWindow?: number;
  outlierIqrMultiplier?: number;
}

export type CustomChartDatumValue = number | string | string[];

export interface CustomChartData {
  data: Array<Record<string, CustomChartDatumValue>>;
  seriesKeys: string[];
  unitLabel: string;
  calcMode: DashboardCalcMode;
}

export const DASHBOARD_ENTRY_IDS_KEY = '__entryIds';
export const getDashboardEntryIdsKey = (seriesKey: string) =>
  `__entryIds_${seriesKey}`;

export const DEFAULT_TIME_BUCKET_SEC = 60;
export const DEFAULT_HISTOGRAM_BIN_SEC = 5;
export const DEFAULT_ROLLING_WINDOW = 3;
export const DEFAULT_OUTLIER_IQR = 1.5;

export const toPositiveNumber = (value: unknown, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
};

export const getDuration = (item: TimelineData) => {
  const duration = item.endTime - item.startTime;
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
};

export const getMetricValue = (item: TimelineData, metric: DashboardMetric) => {
  return metric === 'duration' ? getDuration(item) : 1;
};

export const toTimeLabel = (seconds: number) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export const setEntryIds = (
  target: Record<string, CustomChartDatumValue>,
  seriesKey: string,
  entryIds: string[],
) => {
  target[DASHBOARD_ENTRY_IDS_KEY] = entryIds;
  target[getDashboardEntryIdsKey(seriesKey)] = entryIds;
};

export const percentile = (sorted: number[], ratio: number) => {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};
