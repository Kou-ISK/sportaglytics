import type { MatrixAxisConfig } from '../../types/MatrixConfig';
import type { TimelineData } from '../../types/TimelineData';
import type {
  DashboardAnalysisMode,
  DashboardSeriesFilter,
} from '../../types/Settings';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelByGroupWithFallback,
  getLabelsFromTimelineData,
} from '../../utils/labelExtractors';

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
export const DASHBOARD_ENTRY_IDS_KEY = '__entryIds';
export const getDashboardEntryIdsKey = (seriesKey: string) =>
  `__entryIds_${seriesKey}`;

export interface CustomChartData {
  data: Array<Record<string, CustomChartDatumValue>>;
  seriesKeys: string[];
  unitLabel: string;
  calcMode: DashboardCalcMode;
}

const DEFAULT_TIME_BUCKET_SEC = 60;
const DEFAULT_HISTOGRAM_BIN_SEC = 5;
const DEFAULT_ROLLING_WINDOW = 3;
const DEFAULT_OUTLIER_IQR = 1.5;

const toPositiveNumber = (value: unknown, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
};

const getDuration = (item: TimelineData) => {
  const duration = item.endTime - item.startTime;
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
};

const getMetricValue = (item: TimelineData, metric: DashboardMetric) => {
  return metric === 'duration' ? getDuration(item) : 1;
};

const toTimeLabel = (seconds: number) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const setEntryIds = (
  target: Record<string, CustomChartDatumValue>,
  seriesKey: string,
  entryIds: string[],
) => {
  target[DASHBOARD_ENTRY_IDS_KEY] = entryIds;
  target[getDashboardEntryIdsKey(seriesKey)] = entryIds;
};

const percentile = (sorted: number[], ratio: number) => {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const buildTrendLikeData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
  mode: 'trend' | 'rolling',
): CustomChartData => {
  if (timeline.length === 0) {
    return { data: [], seriesKeys: ['value'], unitLabel: '件', calcMode: 'raw' };
  }
  const bucketSec = toPositiveNumber(config.timeBucketSec, DEFAULT_TIME_BUCKET_SEC);
  const rollingWindow = Math.max(
    1,
    Math.round(toPositiveNumber(config.rollingWindow, DEFAULT_ROLLING_WINDOW)),
  );
  const minStart = Math.min(...timeline.map((item) => item.startTime));
  const maxEnd = Math.max(...timeline.map((item) => item.endTime));
  const baseStart = Math.floor(minStart / bucketSec) * bucketSec;
  const bucketCount = Math.max(
    1,
    Math.ceil((maxEnd - baseStart + 0.0001) / bucketSec),
  );

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    start: baseStart + index * bucketSec,
    end: baseStart + (index + 1) * bucketSec,
    value: 0,
    entryIds: new Set<string>(),
  }));

  timeline.forEach((item) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((item.startTime - baseStart) / bucketSec)),
    );
    const bucket = buckets[bucketIndex];
    bucket.value += getMetricValue(item, config.metric);
    bucket.entryIds.add(item.id);
  });

  const data = buckets.map((bucket, index) => {
    let value = bucket.value;
    let entryIds = Array.from(bucket.entryIds);
    if (mode === 'rolling') {
      const windowStart = Math.max(0, index - rollingWindow + 1);
      const windowBuckets = buckets.slice(windowStart, index + 1);
      const windowTotal = windowBuckets.reduce((sum, item) => sum + item.value, 0);
      value = windowTotal / windowBuckets.length;
      const ids = new Set<string>();
      windowBuckets.forEach((item) => {
        item.entryIds.forEach((id) => ids.add(id));
      });
      entryIds = Array.from(ids);
    }
    const row: Record<string, CustomChartDatumValue> = {
      name: `${toTimeLabel(bucket.start)}-${toTimeLabel(bucket.end)}`,
      value,
    };
    setEntryIds(row, 'value', entryIds);
    return row;
  });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: config.metric === 'duration' ? '秒' : '件',
    calcMode: 'raw',
  };
};

const buildHistogramData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
): CustomChartData => {
  if (timeline.length === 0) {
    return { data: [], seriesKeys: ['value'], unitLabel: '件', calcMode: 'raw' };
  }
  const binSec = toPositiveNumber(
    config.histogramBinSec,
    DEFAULT_HISTOGRAM_BIN_SEC,
  );
  const bins = new Map<
    number,
    { value: number; entryIds: Set<string>; rawCount: number }
  >();

  timeline.forEach((item) => {
    const duration = getDuration(item);
    const binStart = Math.floor(duration / binSec) * binSec;
    const bucket = bins.get(binStart) ?? {
      value: 0,
      entryIds: new Set<string>(),
      rawCount: 0,
    };
    bucket.value += getMetricValue(item, config.metric);
    bucket.rawCount += 1;
    bucket.entryIds.add(item.id);
    bins.set(binStart, bucket);
  });

  const data = Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([binStart, bucket]) => {
      const row: Record<string, CustomChartDatumValue> = {
        name: `${binStart.toFixed(1)}-${(binStart + binSec).toFixed(1)}秒`,
        value: bucket.value,
        rawValue: bucket.rawCount,
      };
      setEntryIds(row, 'value', Array.from(bucket.entryIds));
      return row;
    });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: config.metric === 'duration' ? '秒' : '件',
    calcMode: 'raw',
  };
};

const buildOutlierData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
): CustomChartData => {
  if (timeline.length === 0) {
    return { data: [], seriesKeys: ['value'], unitLabel: '秒', calcMode: 'raw' };
  }
  const multiplier = toPositiveNumber(
    config.outlierIqrMultiplier,
    DEFAULT_OUTLIER_IQR,
  );
  const durations = timeline.map((item) => getDuration(item)).sort((a, b) => a - b);
  const q1 = percentile(durations, 0.25);
  const q3 = percentile(durations, 0.75);
  const iqr = q3 - q1;
  const threshold = q3 + iqr * multiplier;
  const maxRows = Math.max(1, Math.round(toPositiveNumber(config.limit, 20)));

  const outliers = timeline
    .map((item) => ({
      item,
      duration: getDuration(item),
    }))
    .filter(({ duration }) => duration > threshold)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, maxRows);

  const data = outliers.map(({ item, duration }, index) => {
    const action = extractActionFromActionName(item.actionName);
    const row: Record<string, CustomChartDatumValue> = {
      name: `${index + 1}. ${action} @ ${toTimeLabel(item.startTime)}`,
      value: duration,
      rawValue: duration,
    };
    setEntryIds(row, 'value', [item.id]);
    return row;
  });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: '秒',
    calcMode: 'raw',
  };
};

const matchesFilters = (
  item: TimelineData,
  filters?: DashboardSeriesFilter,
  config?: CustomChartConfig,
): boolean => {
  if (!filters) return true;
  if (filters.teamRole) {
    const team = extractTeamFromActionName(item.actionName);
    const roleTeam =
      filters.teamRole === 'team1'
        ? config?.teamRoleMap?.team1
        : config?.teamRoleMap?.team2;
    if (roleTeam && team !== roleTeam) return false;
  }
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
  config?: CustomChartConfig,
): TimelineData[] => {
  if (!filters) return timeline;
  return timeline.filter((item) => matchesFilters(item, filters, config));
};

export const buildCustomChartData = (
  timeline: TimelineData[],
  availableGroups: string[],
  config: CustomChartConfig,
): CustomChartData => {
  const calcMode: DashboardCalcMode = config.calc ?? 'raw';
  const analysisMode: DashboardAnalysisMode = config.analysisMode ?? 'standard';
  const baseFiltered = filterTimeline(timeline, config.baseFilters, config);
  const widgetFiltered = filterTimeline(baseFiltered, config.widgetFilters, config);

  if (analysisMode === 'trend') {
    return buildTrendLikeData(widgetFiltered, config, 'trend');
  }

  if (analysisMode === 'rolling') {
    return buildTrendLikeData(widgetFiltered, config, 'rolling');
  }

  if (analysisMode === 'histogram') {
    return buildHistogramData(widgetFiltered, config);
  }

  if (analysisMode === 'outlier') {
    return buildOutlierData(widgetFiltered, config);
  }

  if (config.series && config.series.length > 0) {
    const seriesValues = config.series.map((series) => {
      const filtered = filterTimeline(widgetFiltered, series.filters, config);
      const entryIds = filtered.map((item) => item.id);
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
        entryIds,
      };
    });

    let data: Array<Record<string, CustomChartDatumValue>> = [];
    let seriesKeys: string[] = [];
    let unitLabel = config.metric === 'duration' ? '秒' : '件';

    if (calcMode === 'difference' && seriesValues.length >= 2) {
      const diff = seriesValues[0].value - seriesValues[1].value;
      const mergedIds = Array.from(
        new Set([...seriesValues[0].entryIds, ...seriesValues[1].entryIds]),
      );
      data = [
        {
          name: '差分',
          value: diff,
          [DASHBOARD_ENTRY_IDS_KEY]: mergedIds,
          [getDashboardEntryIdsKey('value')]: mergedIds,
        },
      ];
      seriesKeys = ['value'];
    } else if (calcMode === 'percentTotal') {
      const total = seriesValues.reduce((sum, entry) => sum + entry.value, 0);
      data = seriesValues.map((entry) => ({
        name: entry.name,
        value: total ? (entry.value / total) * 100 : 0,
        rawValue: entry.value,
        [DASHBOARD_ENTRY_IDS_KEY]: entry.entryIds,
        [getDashboardEntryIdsKey('value')]: entry.entryIds,
      }));
      seriesKeys = ['value'];
      unitLabel = '%';
    } else {
      data = seriesValues.map((entry) => ({
        name: entry.name,
        value: entry.value,
        [DASHBOARD_ENTRY_IDS_KEY]: entry.entryIds,
        [getDashboardEntryIdsKey('value')]: entry.entryIds,
      }));
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
  const entryIdsByPrimary = new Map<string, Record<string, Set<string>>>();

  for (const item of widgetFiltered) {
    const primaryValues = getAxisValues(item, config.primaryAxis);
    const seriesValues = config.seriesEnabled
      ? getAxisValues(item, config.seriesAxis)
      : [seriesFallback];
    const metricValue = metricValueForItem(item);

    for (const primaryValue of primaryValues) {
      const bucket =
        totalsByPrimary.get(primaryValue) ?? ({} as Record<string, number>);
      const bucketEntryIds = entryIdsByPrimary.get(primaryValue) ?? {};
      for (const seriesValue of seriesValues) {
        bucket[seriesValue] = (bucket[seriesValue] || 0) + metricValue;
        const ids = bucketEntryIds[seriesValue] ?? new Set<string>();
        ids.add(item.id);
        bucketEntryIds[seriesValue] = ids;
      }
      totalsByPrimary.set(primaryValue, bucket);
      entryIdsByPrimary.set(primaryValue, bucketEntryIds);
    }
  }

  const totals = Array.from(totalsByPrimary.entries()).map(
    ([label, seriesMap]) => ({
      label,
      total: Object.values(seriesMap).reduce((sum, v) => sum + v, 0),
      seriesMap,
      entryIdMap: entryIdsByPrimary.get(label) ?? {},
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

  let data: Array<Record<string, CustomChartDatumValue>> = limitedTotals.map(
    (entry) => {
      const row: Record<string, CustomChartDatumValue> = {
        name: entry.label,
      };
      for (const [seriesKey, value] of Object.entries(entry.seriesMap)) {
        row[seriesKey] = value;
      }
      const mergedIds = new Set<string>();
      for (const [seriesKey, ids] of Object.entries(entry.entryIdMap)) {
        const values = Array.from(ids);
        row[getDashboardEntryIdsKey(seriesKey)] = values;
        values.forEach((id) => mergedIds.add(id));
      }
      row[DASHBOARD_ENTRY_IDS_KEY] = Array.from(mergedIds);
      return row;
    },
  );
  let unitLabel = config.metric === 'duration' ? '秒' : '件';

  if (calcMode === 'percentTotal') {
    const total = limitedTotals.reduce((sum, entry) => sum + entry.total, 0);
    data = limitedTotals.map((entry) => {
      const next: Record<string, CustomChartDatumValue> = { name: entry.label };
      const mergedIds = new Set<string>();
      for (const [key, value] of Object.entries(entry.seriesMap)) {
        next[key] = total ? (value / total) * 100 : 0;
        next[`__raw_${key}`] = value;
        const ids = Array.from(entry.entryIdMap[key] ?? []);
        next[getDashboardEntryIdsKey(key)] = ids;
        ids.forEach((id) => mergedIds.add(id));
      }
      next[DASHBOARD_ENTRY_IDS_KEY] = Array.from(mergedIds);
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
