import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelByGroupWithFallback,
  getLabelsFromTimelineData,
} from '../../../../../../../utils/labelExtractors';

export type DashboardMetric = 'count' | 'duration';
export type DashboardCalcMode = 'raw' | 'percentTotal' | 'difference';

export interface DashboardSeriesFilter {
  team?: string;
  action?: string;
  labelGroup?: string;
  labelValue?: string;
}

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
  limit?: number;
  series?: DashboardSeriesDefinition[];
  calc?: DashboardCalcMode;
  baseFilters?: DashboardSeriesFilter;
  widgetFilters?: DashboardSeriesFilter;
}

export interface CustomChartData {
  data: Array<Record<string, number | string>>;
  seriesKeys: string[];
  unitLabel: string;
  calcMode: DashboardCalcMode;
}

const matchesFilters = (
  item: TimelineData,
  filters?: DashboardSeriesFilter,
): boolean => {
  if (!filters) return true;
  if (filters.team) {
    const team = extractTeamFromActionName(item.actionName);
    if (team !== filters.team) return false;
  }
  if (filters.action) {
    const action = extractActionFromActionName(item.actionName);
    if (action !== filters.action) return false;
  }
  if (filters.labelGroup) {
    const labels = getLabelsFromTimelineData(item);
    const inGroup = labels.filter((label) => label.group === filters.labelGroup);
    if (filters.labelValue) {
      const hasMatch = inGroup.some((label) => label.name === filters.labelValue);
      if (!hasMatch) return false;
    } else if (inGroup.length === 0) {
      return false;
    }
  }
  return true;
};

const filterTimeline = (
  timeline: TimelineData[],
  filters?: DashboardSeriesFilter,
): TimelineData[] => {
  if (!filters) return timeline;
  return timeline.filter((item) => matchesFilters(item, filters));
};

export const buildCustomChartData = (
  timeline: TimelineData[],
  availableGroups: string[],
  config: CustomChartConfig,
): CustomChartData => {
  const calcMode: DashboardCalcMode = config.calc ?? 'raw';
  const baseFiltered = filterTimeline(timeline, config.baseFilters);
  const widgetFiltered = filterTimeline(baseFiltered, config.widgetFilters);

  if (config.series && config.series.length > 0) {
    const seriesValues = config.series.map((series) => {
      const filtered = filterTimeline(widgetFiltered, series.filters);
      const rawValue =
        config.metric === 'duration'
          ? filtered.reduce((sum, item) => {
              const duration = item.endTime - item.startTime;
              return sum + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
            }, 0)
          : filtered.length;
      return {
        id: series.id,
        name: series.name || 'シリーズ',
        value: rawValue,
      };
    });

    let data: Array<Record<string, number | string>> = [];
    let seriesKeys: string[] = [];
    let unitLabel = config.metric === 'duration' ? '秒' : '件';

    if (calcMode === 'difference' && seriesValues.length >= 2) {
      const diff = seriesValues[0].value - seriesValues[1].value;
      data = [{ name: '差分', value: diff }];
      seriesKeys = ['value'];
    } else if (calcMode === 'percentTotal') {
      const total = seriesValues.reduce((sum, entry) => sum + entry.value, 0);
      data = seriesValues.map((entry) => ({
        name: entry.name,
        value: total ? (entry.value / total) * 100 : 0,
      }));
      seriesKeys = ['value'];
      unitLabel = '%';
    } else {
      data = seriesValues.map((entry) => ({ name: entry.name, value: entry.value }));
      seriesKeys = ['value'];
    }

    return {
      data,
      seriesKeys,
      unitLabel,
      calcMode,
    };
  }

  const getAxisValues = (
    item: TimelineData,
    axis: MatrixAxisConfig,
  ): string[] => {
    if (axis.type === 'team') {
      return [extractTeamFromActionName(item.actionName)];
    }
    if (axis.type === 'action') {
      return [extractActionFromActionName(item.actionName)];
    }

    const groupName =
      axis.value && axis.value !== '' ? axis.value : availableGroups[0] || '';

    if (groupName === 'all_labels') {
      const labels = getLabelsFromTimelineData(item);
      if (!labels.length) return ['未設定'];
      return labels.map((label) => `${label.group}:${label.name}`);
    }

    return [getLabelByGroupWithFallback(item, groupName, '未設定')];
  };

  const metricValueForItem = (item: TimelineData) => {
    if (config.metric === 'duration') {
      const duration = item.endTime - item.startTime;
      return Number.isFinite(duration) ? Math.max(0, duration) : 0;
    }
    return 1;
  };

  const seriesFallback = '集計';
  const totalsByPrimary = new Map<string, Record<string, number>>();

  for (const item of widgetFiltered) {
    const primaryValues = getAxisValues(item, config.primaryAxis);
    const seriesValues = config.seriesEnabled
      ? getAxisValues(item, config.seriesAxis)
      : [seriesFallback];
    const metricValue = metricValueForItem(item);

    for (const primaryValue of primaryValues) {
      const bucket =
        totalsByPrimary.get(primaryValue) ?? ({} as Record<string, number>);
      for (const seriesValue of seriesValues) {
        bucket[seriesValue] = (bucket[seriesValue] || 0) + metricValue;
      }
      totalsByPrimary.set(primaryValue, bucket);
    }
  }

  const totals = Array.from(totalsByPrimary.entries()).map(
    ([label, seriesMap]) => ({
      label,
      total: Object.values(seriesMap).reduce((sum, v) => sum + v, 0),
      seriesMap,
    }),
  );

  totals.sort((a, b) => b.total - a.total);

  const limitedTotals =
    typeof config.limit === 'number' && config.limit > 0
      ? totals.slice(0, config.limit)
      : totals;

  const seriesTotals = new Map<string, number>();
  for (const entry of limitedTotals) {
    for (const [seriesKey, value] of Object.entries(entry.seriesMap)) {
      seriesTotals.set(seriesKey, (seriesTotals.get(seriesKey) || 0) + value);
    }
  }

  const seriesKeys = Array.from(seriesTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  let data = limitedTotals.map((entry) => ({
    name: entry.label,
    ...entry.seriesMap,
  }));
  let unitLabel = config.metric === 'duration' ? '秒' : '件';

  if (calcMode === 'percentTotal') {
    const total = limitedTotals.reduce((sum, entry) => sum + entry.total, 0);
    data = limitedTotals.map((entry) => {
      const next: Record<string, number | string> = { name: entry.label };
      for (const [key, value] of Object.entries(entry.seriesMap)) {
        next[key] = total ? (value / total) * 100 : 0;
      }
      return next;
    });
    unitLabel = '%';
  }

  return {
    data,
    seriesKeys,
    unitLabel,
    calcMode,
  };
};
