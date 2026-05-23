import type { TimelineData } from '../../types/timeline/core';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelByGroupWithFallback,
  getLabelsFromTimelineData,
  normalizeLabelGroupName,
} from '../../utils/labelExtractors';
import type {
  CustomChartConfig,
  CustomChartData,
  CustomChartDatumValue,
  DashboardCalcMode,
} from './customChartData.shared';
import {
  DASHBOARD_ENTRY_IDS_KEY,
  getDashboardEntryIdsKey,
  getDuration,
} from './customChartData.shared';
import {
  buildHistogramData,
  buildOutlierData,
  buildTrendLikeData,
} from './customChartDataModes';

export {
  DASHBOARD_ENTRY_IDS_KEY,
  getDashboardEntryIdsKey,
} from './customChartData.shared';
export type { CustomChartDatumValue } from './customChartData.shared';

const matchesFilters = (
  item: TimelineData,
  filters?: CustomChartConfig['baseFilters'],
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
    const filterGroup = normalizeLabelGroupName(filters.labelGroup);
    const labels = getLabelsFromTimelineData(item);
    const inGroup = labels.filter((label) => label.group === filterGroup);
    if (filters.labelValue) {
      const hasMatch = inGroup.some(
        (label) => label.name === filters.labelValue,
      );
      if (!hasMatch) return false;
    } else if (inGroup.length === 0) {
      return false;
    }
  }
  return true;
};

const filterTimeline = (
  timeline: TimelineData[],
  filters?: CustomChartConfig['baseFilters'],
  config?: CustomChartConfig,
): TimelineData[] => {
  if (!filters) return timeline;
  return timeline.filter((item) => matchesFilters(item, filters, config));
};

const getAxisValues = (
  item: TimelineData,
  axis: CustomChartConfig['primaryAxis'],
  availableGroups: string[],
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

const buildSeriesRows = (
  timeline: TimelineData[],
  config: CustomChartConfig,
  calcMode: DashboardCalcMode,
): CustomChartData | null => {
  if (!config.series || config.series.length === 0) return null;

  const seriesValues = config.series.map((series) => {
    const filtered = filterTimeline(timeline, series.filters, config);
    const entryIds = filtered.map((item) => item.id);
    const rawValue =
      config.metric === 'duration'
        ? filtered.reduce((sum, item) => sum + getDuration(item), 0)
        : filtered.length;
    return {
      id: series.id,
      name: series.name || 'シリーズ',
      value: rawValue,
      entryIds,
    };
  });

  let data: Array<Record<string, CustomChartDatumValue>> = [];
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
  } else if (calcMode === 'percentTotal') {
    const total = seriesValues.reduce((sum, entry) => sum + entry.value, 0);
    data = seriesValues.map((entry) => ({
      name: entry.name,
      value: total ? (entry.value / total) * 100 : 0,
      rawValue: entry.value,
      [DASHBOARD_ENTRY_IDS_KEY]: entry.entryIds,
      [getDashboardEntryIdsKey('value')]: entry.entryIds,
    }));
    unitLabel = '%';
  } else {
    data = seriesValues.map((entry) => ({
      name: entry.name,
      value: entry.value,
      [DASHBOARD_ENTRY_IDS_KEY]: entry.entryIds,
      [getDashboardEntryIdsKey('value')]: entry.entryIds,
    }));
  }

  return {
    data,
    seriesKeys: ['value'],
    unitLabel,
    calcMode,
  };
};

const buildAxisRows = (
  timeline: TimelineData[],
  availableGroups: string[],
  config: CustomChartConfig,
  calcMode: DashboardCalcMode,
): CustomChartData => {
  const seriesFallback = '集計';
  const totalsByPrimary = new Map<string, Record<string, number>>();
  const entryIdsByPrimary = new Map<string, Record<string, Set<string>>>();

  for (const item of timeline) {
    const primaryValues = getAxisValues(
      item,
      config.primaryAxis,
      availableGroups,
    );
    const seriesValues = config.seriesEnabled
      ? getAxisValues(item, config.seriesAxis, availableGroups)
      : [seriesFallback];
    const metricValue = config.metric === 'duration' ? getDuration(item) : 1;

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
      total: Object.values(seriesMap).reduce((sum, value) => sum + value, 0),
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
      const row: Record<string, CustomChartDatumValue> = { name: entry.label };
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
      const row: Record<string, CustomChartDatumValue> = { name: entry.label };
      const mergedIds = new Set<string>();
      for (const [seriesKey, value] of Object.entries(entry.seriesMap)) {
        row[seriesKey] = total ? (value / total) * 100 : 0;
        row[`__raw_${seriesKey}`] = value;
        const ids = Array.from(entry.entryIdMap[seriesKey] ?? []);
        row[getDashboardEntryIdsKey(seriesKey)] = ids;
        ids.forEach((id) => mergedIds.add(id));
      }
      row[DASHBOARD_ENTRY_IDS_KEY] = Array.from(mergedIds);
      return row;
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

export const buildCustomChartData = (
  timeline: TimelineData[],
  availableGroups: string[],
  config: CustomChartConfig,
): CustomChartData => {
  const calcMode: DashboardCalcMode = config.calc ?? 'raw';
  const analysisMode = config.analysisMode ?? 'standard';
  const baseFiltered = filterTimeline(timeline, config.baseFilters, config);
  const widgetFiltered = filterTimeline(
    baseFiltered,
    config.widgetFilters,
    config,
  );

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

  const seriesData = buildSeriesRows(widgetFiltered, config, calcMode);
  if (seriesData) return seriesData;

  return buildAxisRows(widgetFiltered, availableGroups, config, calcMode);
};
