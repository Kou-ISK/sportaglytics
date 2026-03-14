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

export type DashboardPresetMode = 'labelPie' | 'compareBar' | 'seriesPie';

export interface UseDashboardWidgetDialogStateParams {
  open: boolean;
  availableGroups: string[];
  availableActions: string[];
  availableLabelValues: Record<string, string[]>;
  initial?: AnalysisDashboardWidget | null;
  onSave: (widget: AnalysisDashboardWidget) => void;
}

export interface DashboardWidgetDialogState {
  title: string;
  chartType: DashboardChartType;
  metric: DashboardMetric;
  analysisMode: DashboardAnalysisMode;
  primaryAxis: MatrixAxisConfig;
  seriesEnabled: boolean;
  seriesAxis: MatrixAxisConfig;
  colSpan: 4 | 6 | 12;
  limit: number | '';
  dataMode: 'axis' | 'series';
  series: DashboardSeriesDefinition[];
  calcMode: DashboardCalcMode;
  widgetFilters: DashboardSeriesFilter;
  quickAction: string;
  quickLabelGroup: string;
  showTemplates: boolean;
  showFilters: boolean;
  showAdvanced: boolean;
  timeBucketSec: number | '';
  histogramBinSec: number | '';
  rollingWindow: number | '';
  outlierIqrMultiplier: number | '';
  resolvedSeriesEnabled: boolean;
  filterSummary: string[];
  setTitle: (value: string) => void;
  setChartType: (value: DashboardChartType) => void;
  setMetric: (value: DashboardMetric) => void;
  setAnalysisMode: (value: DashboardAnalysisMode) => void;
  setPrimaryAxis: (value: MatrixAxisConfig) => void;
  setSeriesEnabled: (value: boolean) => void;
  setSeriesAxis: (value: MatrixAxisConfig) => void;
  setColSpan: (value: 4 | 6 | 12) => void;
  setLimit: (value: number | '') => void;
  setDataMode: (value: 'axis' | 'series') => void;
  setCalcMode: (value: DashboardCalcMode) => void;
  setWidgetFilters: (value: DashboardSeriesFilter) => void;
  setQuickAction: (value: string) => void;
  setQuickLabelGroup: (value: string) => void;
  setShowTemplates: (value: boolean) => void;
  setShowFilters: (value: boolean) => void;
  setShowAdvanced: (value: boolean) => void;
  setTimeBucketSec: (value: number | '') => void;
  setHistogramBinSec: (value: number | '') => void;
  setRollingWindow: (value: number | '') => void;
  setOutlierIqrMultiplier: (value: number | '') => void;
  applyPreset: (mode: DashboardPresetMode) => void;
  handleSave: () => void;
  handleSeriesChange: (
    id: string,
    patch: Partial<DashboardSeriesDefinition>,
  ) => void;
  handleSeriesFilterChange: (
    id: string,
    patch: Partial<DashboardSeriesFilter>,
  ) => void;
  addSeries: () => void;
  removeSeries: (id: string) => void;
  updateWidgetFilters: (patch: Partial<DashboardSeriesFilter>) => void;
  handleQuickPieApply: () => void;
  getAxisLabel: (axis: MatrixAxisConfig) => string;
  getChartLabel: (type: DashboardChartType) => string;
  getAnalysisModeLabel: (mode: DashboardAnalysisMode) => string;
}
