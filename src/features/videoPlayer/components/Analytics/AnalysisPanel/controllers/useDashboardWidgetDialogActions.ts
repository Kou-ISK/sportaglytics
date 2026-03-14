import type React from 'react';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type {
  AnalysisDashboardWidget,
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { useDashboardWidgetPresetActions } from './dashboardWidgetPresetActions';
import { useDashboardWidgetSaveAction } from './dashboardWidgetSaveAction';
import { useDashboardWidgetSeriesActions } from './dashboardWidgetSeriesActions';

interface UseDashboardWidgetDialogActionsParams {
  availableGroups: string[];
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
  quickAction: string;
  quickLabelGroup: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setAnalysisMode: React.Dispatch<React.SetStateAction<DashboardAnalysisMode>>;
  setDataMode: React.Dispatch<React.SetStateAction<'axis' | 'series'>>;
  setChartType: React.Dispatch<React.SetStateAction<DashboardChartType>>;
  setMetric: React.Dispatch<React.SetStateAction<DashboardMetric>>;
  setCalcMode: React.Dispatch<React.SetStateAction<DashboardCalcMode>>;
  setSeriesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setPrimaryAxis: React.Dispatch<React.SetStateAction<MatrixAxisConfig>>;
  setWidgetFilters: React.Dispatch<React.SetStateAction<DashboardSeriesFilter>>;
  setSeries: React.Dispatch<React.SetStateAction<DashboardSeriesDefinition[]>>;
}

export const useDashboardWidgetDialogActions = ({
  availableGroups,
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
  quickAction,
  quickLabelGroup,
  setTitle,
  setAnalysisMode,
  setDataMode,
  setChartType,
  setMetric,
  setCalcMode,
  setSeriesEnabled,
  setPrimaryAxis,
  setWidgetFilters,
  setSeries,
}: UseDashboardWidgetDialogActionsParams) => {
  const seriesActions = useDashboardWidgetSeriesActions({
    setSeries,
    setWidgetFilters,
  });

  const presetActions = useDashboardWidgetPresetActions({
    availableGroups,
    title,
    quickAction,
    quickLabelGroup,
    seriesCount: series.length,
    setTitle,
    setAnalysisMode,
    setDataMode,
    setChartType,
    setMetric,
    setCalcMode,
    setSeriesEnabled,
    setPrimaryAxis,
    setWidgetFilters,
    setSeries,
  });

  const { handleSave } = useDashboardWidgetSaveAction({
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
  });

  return {
    addSeriesPair: seriesActions.addSeriesPair,
    addSeries: seriesActions.addSeries,
    removeSeries: seriesActions.removeSeries,
    handleSeriesChange: seriesActions.handleSeriesChange,
    handleSeriesFilterChange: seriesActions.handleSeriesFilterChange,
    updateWidgetFilters: seriesActions.updateWidgetFilters,
    applyPreset: presetActions.applyPreset,
    handleQuickPieApply: presetActions.handleQuickPieApply,
    handleSave,
  };
};
