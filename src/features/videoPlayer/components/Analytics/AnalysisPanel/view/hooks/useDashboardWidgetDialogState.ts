import { useEffect, useMemo, useState } from 'react';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type {
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import type {
  DashboardWidgetDialogState,
  UseDashboardWidgetDialogStateParams,
} from './dashboardWidgetDialogState.types';
import {
  buildFilterSummary,
  generateWidgetId,
  getAnalysisModeLabel,
  getAxisLabel,
  getChartLabel,
  normalizePositive,
  resolveDefaultGroup,
} from './dashboardWidgetDialogState.utils';

export const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
export const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
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
  const [widgetFilters, setWidgetFilters] =
    useState<DashboardSeriesFilter>(DEFAULT_WIDGET_FILTERS);
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

  const addSeriesPair = () => {
    setSeries((prev) => {
      const firstIndex = prev.length + 1;
      return [
        ...prev,
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex}`,
          filters: {},
        },
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex + 1}`,
          filters: {},
        },
      ];
    });
  };

  useEffect(() => {
    if (dataMode === 'series' && series.length === 0) {
      addSeriesPair();
    }
  }, [dataMode, series.length]);

  const applyPreset = (mode: 'labelPie' | 'compareBar' | 'seriesPie') => {
    setAnalysisMode('standard');
    if (mode === 'labelPie') {
      setDataMode('axis');
      setChartType('pie');
      setMetric('count');
      setCalcMode('percentTotal');
      setSeriesEnabled(false);
      setPrimaryAxis({
        type: 'group',
        value: resolveDefaultGroup(availableGroups, 'actionResult'),
      });
      setShowFilters(true);
      if (!title.trim()) setTitle('ラベル比率');
      return;
    }
    if (mode === 'compareBar') {
      setDataMode('axis');
      setChartType('bar');
      setMetric('count');
      setCalcMode('raw');
      setSeriesEnabled(false);
      setPrimaryAxis({
        type: 'group',
        value: resolveDefaultGroup(availableGroups, 'actionType'),
      });
      setShowFilters(true);
      if (!title.trim()) setTitle('件数比較');
      return;
    }
    setDataMode('series');
    setChartType('pie');
    setMetric('count');
    setCalcMode('percentTotal');
    setShowFilters(true);
    if (series.length === 0) {
      setSeries([
        { id: generateWidgetId(), name: 'シリーズ1', filters: {} },
        { id: generateWidgetId(), name: 'シリーズ2', filters: {} },
      ]);
    }
    if (!title.trim()) setTitle('シリーズ比較');
  };

  const filterSummary = buildFilterSummary(widgetFilters);

  const handleSave = () => {
    const resolvedTitle = title.trim() || 'カスタムチャート';
    const normalizedLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;
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
      id: initial?.id ?? generateWidgetId(),
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
  };

  const handleSeriesChange = (
    id: string,
    patch: Partial<DashboardSeriesDefinition>,
  ) => {
    setSeries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleSeriesFilterChange = (
    id: string,
    patch: Partial<DashboardSeriesFilter>,
  ) => {
    setSeries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, filters: { ...item.filters, ...patch } } : item,
      ),
    );
  };

  const addSeries = () => {
    setSeries((prev) => [
      ...prev,
      {
        id: generateWidgetId(),
        name: `シリーズ${prev.length + 1}`,
        filters: {},
      },
    ]);
  };

  const removeSeries = (id: string) => {
    setSeries((prev) => prev.filter((item) => item.id !== id));
  };

  const updateWidgetFilters = (patch: Partial<DashboardSeriesFilter>) => {
    setWidgetFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleQuickPieApply = () => {
    const labelGroup = quickLabelGroup || availableGroups[0] || 'all_labels';
    setAnalysisMode('standard');
    setDataMode('axis');
    setChartType('pie');
    setMetric('count');
    setCalcMode('percentTotal');
    setSeriesEnabled(false);
    setPrimaryAxis({ type: 'group', value: labelGroup });
    setWidgetFilters({
      action: quickAction || undefined,
      labelGroup: labelGroup || undefined,
      labelValue: undefined,
    });
    if (!title.trim()) {
      const parts = [quickAction, labelGroup].filter(Boolean);
      setTitle(parts.length ? `${parts.join(' ')} 比率` : 'ラベル比率');
    }
  };

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
    applyPreset,
    handleSave,
    handleSeriesChange,
    handleSeriesFilterChange,
    addSeries,
    removeSeries,
    updateWidgetFilters,
    handleQuickPieApply,
    getAxisLabel,
    getChartLabel,
    getAnalysisModeLabel,
  };
};
