import { useEffect, useMemo, useState } from 'react';
import type { MatrixAxisConfig } from '../../../../../../types/analysis/matrix';
import type {
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../types/settings/coreTypes';
import type {
  DashboardWidgetDialogState,
  UseDashboardWidgetDialogStateParams,
} from './dashboardWidgetDialogState.types';
import {
  buildFilterSummary,
  getAnalysisModeLabel,
  getAxisLabel,
  getChartLabel,
} from './dashboardWidgetDialogState.utils';
import { useDashboardWidgetDialogActions } from './useDashboardWidgetDialogActions';

const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
  type: 'group',
  value: 'all_labels',
};
export const DEFAULT_WIDGET_FILTERS: DashboardSeriesFilter = {};

export const useDashboardWidgetDialogState = ({
  open,
  availableGroups,
  availableActions: _availableActions,
  availableLabelValues: _availableLabelValues,
  initial,
  onSave,
}: UseDashboardWidgetDialogStateParams): DashboardWidgetDialogState => {
  const [title, setTitle] = useState('');
  const [chartType, setChartType] = useState<DashboardChartType>('bar');
  const [metric, setMetric] = useState<DashboardMetric>('count');
  const [analysisMode, setAnalysisMode] =
    useState<DashboardAnalysisMode>('standard');
  const [primaryAxis, setPrimaryAxis] =
    useState<MatrixAxisConfig>(DEFAULT_PRIMARY_AXIS);
  const [seriesEnabled, setSeriesEnabled] = useState(false);
  const [seriesAxis, setSeriesAxis] =
    useState<MatrixAxisConfig>(DEFAULT_SERIES_AXIS);
  const [colSpan, setColSpan] = useState<4 | 6 | 12>(6);
  const [limit, setLimit] = useState<number | ''>('');
  const [dataMode, setDataMode] = useState<'axis' | 'series'>('axis');
  const [series, setSeries] = useState<DashboardSeriesDefinition[]>([]);
  const [calcMode, setCalcMode] = useState<DashboardCalcMode>('raw');
  const [widgetFilters, setWidgetFilters] = useState<DashboardSeriesFilter>(
    DEFAULT_WIDGET_FILTERS,
  );
  const [quickAction, setQuickAction] = useState('');
  const [quickLabelGroup, setQuickLabelGroup] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeBucketSec, setTimeBucketSec] = useState<number | ''>(60);
  const [histogramBinSec, setHistogramBinSec] = useState<number | ''>(5);
  const [rollingWindow, setRollingWindow] = useState<number | ''>(3);
  const [outlierIqrMultiplier, setOutlierIqrMultiplier] = useState<number | ''>(
    1.5,
  );

  useEffect(() => {
    if (!initial) {
      setTitle('');
      setChartType('bar');
      setMetric('count');
      setAnalysisMode('standard');
      setPrimaryAxis(DEFAULT_PRIMARY_AXIS);
      setSeriesEnabled(false);
      setSeriesAxis(DEFAULT_SERIES_AXIS);
      setColSpan(6);
      setLimit('');
      setDataMode('axis');
      setSeries([]);
      setCalcMode('raw');
      setWidgetFilters(DEFAULT_WIDGET_FILTERS);
      setQuickAction('');
      setQuickLabelGroup('');
      setShowTemplates(false);
      setShowFilters(true);
      setShowAdvanced(false);
      setTimeBucketSec(60);
      setHistogramBinSec(5);
      setRollingWindow(3);
      setOutlierIqrMultiplier(1.5);
      return;
    }
    setTitle(initial.title);
    setChartType(initial.chartType);
    setMetric(initial.metric);
    setAnalysisMode(initial.analysisMode ?? 'standard');
    setPrimaryAxis(initial.primaryAxis);
    setSeriesEnabled(initial.seriesEnabled);
    setSeriesAxis(initial.seriesAxis);
    setColSpan(initial.colSpan);
    setLimit(initial.limit ?? '');
    setDataMode(initial.dataMode ?? 'axis');
    setSeries(initial.series ?? []);
    setCalcMode(initial.calc ?? 'raw');
    setWidgetFilters(initial.widgetFilters ?? DEFAULT_WIDGET_FILTERS);
    setQuickAction(initial.widgetFilters?.action ?? '');
    setQuickLabelGroup(initial.primaryAxis.value ?? '');
    setShowTemplates(false);
    setShowAdvanced(false);
    setTimeBucketSec(initial.timeBucketSec ?? 60);
    setHistogramBinSec(initial.histogramBinSec ?? 5);
    setRollingWindow(initial.rollingWindow ?? 3);
    setOutlierIqrMultiplier(initial.outlierIqrMultiplier ?? 1.5);
    setShowFilters(
      Boolean(
        initial.widgetFilters?.team ||
        initial.widgetFilters?.action ||
        initial.widgetFilters?.labelGroup ||
        initial.widgetFilters?.labelValue,
      ),
    );
  }, [initial, open]);

  const resolvedSeriesEnabled = useMemo(() => {
    if (analysisMode !== 'standard') return false;
    if (chartType === 'stacked') return true;
    if (chartType === 'pie') return false;
    return seriesEnabled;
  }, [analysisMode, chartType, seriesEnabled]);

  useEffect(() => {
    if (analysisMode === 'standard') return;
    if (dataMode !== 'axis') setDataMode('axis');
    if (chartType !== 'bar') setChartType('bar');
    if (calcMode !== 'raw') setCalcMode('raw');
    if (seriesEnabled) setSeriesEnabled(false);
    if (analysisMode === 'outlier' && metric !== 'duration') {
      setMetric('duration');
    }
  }, [analysisMode, calcMode, chartType, dataMode, metric, seriesEnabled]);

  const actions = useDashboardWidgetDialogActions({
    availableGroups,
    initialId: initial?.id,
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
  });

  useEffect(() => {
    if (dataMode === 'series' && series.length === 0) {
      actions.addSeriesPair();
    }
  }, [actions, dataMode, series.length]);

  const filterSummary = buildFilterSummary(widgetFilters);

  return {
    title,
    chartType,
    metric,
    analysisMode,
    primaryAxis,
    seriesEnabled,
    seriesAxis,
    colSpan,
    limit,
    dataMode,
    series,
    calcMode,
    widgetFilters,
    quickAction,
    quickLabelGroup,
    showTemplates,
    showFilters,
    showAdvanced,
    timeBucketSec,
    histogramBinSec,
    rollingWindow,
    outlierIqrMultiplier,
    resolvedSeriesEnabled,
    filterSummary,
    setTitle,
    setChartType,
    setMetric,
    setAnalysisMode,
    setPrimaryAxis,
    setSeriesEnabled,
    setSeriesAxis,
    setColSpan,
    setLimit,
    setDataMode,
    setCalcMode,
    setWidgetFilters,
    setQuickAction,
    setQuickLabelGroup,
    setShowTemplates,
    setShowFilters,
    setShowAdvanced,
    setTimeBucketSec,
    setHistogramBinSec,
    setRollingWindow,
    setOutlierIqrMultiplier,
    applyPreset: actions.applyPreset,
    handleSave: actions.handleSave,
    handleSeriesChange: actions.handleSeriesChange,
    handleSeriesFilterChange: actions.handleSeriesFilterChange,
    addSeries: actions.addSeries,
    removeSeries: actions.removeSeries,
    updateWidgetFilters: actions.updateWidgetFilters,
    handleQuickPieApply: actions.handleQuickPieApply,
    getAxisLabel,
    getChartLabel,
    getAnalysisModeLabel,
  };
};
