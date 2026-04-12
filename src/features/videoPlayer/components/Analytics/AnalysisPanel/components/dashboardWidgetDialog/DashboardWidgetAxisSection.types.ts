import type {
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';

export interface DashboardWidgetSeriesConfigProps {
  calcMode: DashboardCalcMode;
  setCalcMode: (value: DashboardCalcMode) => void;
  addSeries: () => void;
  series: DashboardSeriesDefinition[];
  handleSeriesChange: (
    id: string,
    patch: Partial<DashboardSeriesDefinition>,
  ) => void;
  removeSeries: (id: string) => void;
  handleSeriesFilterChange: (
    id: string,
    patch: Partial<DashboardSeriesFilter>,
  ) => void;
  availableActions: string[];
  availableGroups: string[];
  availableLabelValues: Record<string, string[]>;
}

export interface DashboardWidgetAnalysisModeSettingsProps {
  analysisMode: DashboardAnalysisMode;
  timeBucketSec: number | '';
  setTimeBucketSec: (value: number | '') => void;
  rollingWindow: number | '';
  setRollingWindow: (value: number | '') => void;
  histogramBinSec: number | '';
  setHistogramBinSec: (value: number | '') => void;
  outlierIqrMultiplier: number | '';
  setOutlierIqrMultiplier: (value: number | '') => void;
}

export interface DashboardWidgetAxisSectionProps
  extends
    DashboardWidgetSeriesConfigProps,
    DashboardWidgetAnalysisModeSettingsProps {
  dataMode: 'axis' | 'series';
  primaryAxis: MatrixAxisConfig;
  setPrimaryAxis: (value: MatrixAxisConfig) => void;
  resolvedSeriesEnabled: boolean;
  setSeriesEnabled: (value: boolean) => void;
  chartType: DashboardChartType;
  seriesAxis: MatrixAxisConfig;
  setSeriesAxis: (value: MatrixAxisConfig) => void;
}
