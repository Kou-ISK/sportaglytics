import { useCallback } from 'react';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type {
  AnalysisDashboardWidget,
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import {
  generateWidgetId,
  normalizePositive,
} from './dashboardWidgetDialogState.utils';

interface UseDashboardWidgetSaveActionParams {
  initialId?: string;
  onSave: (widget: AnalysisDashboardWidget) => void;
  title: string;
  chartType: DashboardChartType;
  metric: DashboardMetric;
  analysisMode: DashboardAnalysisMode;
  primaryAxis: MatrixAxisConfig;
  resolvedSeriesEnabled: boolean;
  seriesAxis: MatrixAxisConfig;
  colSpan: 4 | 6 | 12;
  limit: number | '';
  dataMode: 'axis' | 'series';
  series: DashboardSeriesDefinition[];
  calcMode: DashboardCalcMode;
  widgetFilters: DashboardSeriesFilter;
  timeBucketSec: number | '';
  histogramBinSec: number | '';
  rollingWindow: number | '';
  outlierIqrMultiplier: number | '';
}

export const useDashboardWidgetSaveAction = ({
  initialId,
  onSave,
  title,
  chartType,
  metric,
  analysisMode,
  primaryAxis,
  resolvedSeriesEnabled,
  seriesAxis,
  colSpan,
  limit,
  dataMode,
  series,
  calcMode,
  widgetFilters,
  timeBucketSec,
  histogramBinSec,
  rollingWindow,
  outlierIqrMultiplier,
}: UseDashboardWidgetSaveActionParams) => {
  const handleSave = useCallback(() => {
    const resolvedTitle = title.trim() || 'カスタムチャート';
    const normalizedLimit = typeof limit === 'number' && limit > 0 ? limit : undefined;
    const resolvedMode = analysisMode;
    const resolvedChartType: DashboardChartType =
      resolvedMode === 'standard' ? chartType : 'bar';
    const resolvedMetric: DashboardMetric =
      resolvedMode === 'outlier' ? 'duration' : metric;
    const resolvedDataMode = resolvedMode === 'standard' ? dataMode : 'axis';
    const resolvedCalcMode: DashboardCalcMode =
      resolvedMode === 'standard' ? calcMode : 'raw';
    const resolvedSeries =
      resolvedMode === 'standard' && resolvedDataMode === 'series' ? series : [];

    onSave({
      id: initialId ?? generateWidgetId(),
      title: resolvedTitle,
      chartType: resolvedChartType,
      metric: resolvedMetric,
      analysisMode: resolvedMode,
      primaryAxis,
      seriesEnabled: resolvedMode === 'standard' ? resolvedSeriesEnabled : false,
      seriesAxis,
      colSpan,
      limit: normalizedLimit,
      dataMode: resolvedDataMode,
      series: resolvedSeries,
      calc: resolvedCalcMode,
      widgetFilters,
      timeBucketSec:
        resolvedMode === 'trend' || resolvedMode === 'rolling'
          ? normalizePositive(timeBucketSec, 60)
          : undefined,
      histogramBinSec:
        resolvedMode === 'histogram'
          ? normalizePositive(histogramBinSec, 5)
          : undefined,
      rollingWindow:
        resolvedMode === 'rolling' ? normalizePositive(rollingWindow, 3) : undefined,
      outlierIqrMultiplier:
        resolvedMode === 'outlier'
          ? normalizePositive(outlierIqrMultiplier, 1.5)
          : undefined,
    });
  }, [
    analysisMode,
    calcMode,
    chartType,
    colSpan,
    dataMode,
    histogramBinSec,
    initialId,
    limit,
    metric,
    onSave,
    outlierIqrMultiplier,
    primaryAxis,
    resolvedSeriesEnabled,
    rollingWindow,
    series,
    seriesAxis,
    timeBucketSec,
    title,
    widgetFilters,
  ]);

  return { handleSave };
};
