import type { MatrixAxisConfig } from '../analysis/matrix';
import type {
  AnalysisDashboard,
  AnalysisDashboardConfig,
  AnalysisDashboardWidget,
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from './coreTypes';
import {
  createDefaultAnalysisDashboard,
  createTemplateDashboardWidgets,
} from './defaults';
import {
  asBoolean,
  asNonEmptyString,
  asPositiveNumber,
  isPlainObject,
} from './normalizerUtils';

const TEMPLATE_WIDGET_FALLBACK = createTemplateDashboardWidgets()[0];

const normalizeMatrixAxis = (
  value: unknown,
  fallback: MatrixAxisConfig,
): MatrixAxisConfig => {
  if (!isPlainObject(value)) {
    return { ...fallback };
  }

  const type =
    value.type === 'group' || value.type === 'team' || value.type === 'action'
      ? value.type
      : fallback.type;
  const normalizedValue = asNonEmptyString(value.value);

  return {
    type,
    ...(normalizedValue ? { value: normalizedValue } : {}),
  };
};

const normalizeDashboardMetric = (
  value: unknown,
  fallback: DashboardMetric,
): DashboardMetric => {
  return value === 'duration' ? 'duration' : fallback;
};

const normalizeDashboardChartType = (
  value: unknown,
  fallback: DashboardChartType,
): DashboardChartType => {
  return value === 'bar' || value === 'stacked' || value === 'pie'
    ? value
    : fallback;
};

const normalizeDashboardCalcMode = (
  value: unknown,
  fallback?: DashboardCalcMode,
): DashboardCalcMode | undefined => {
  if (value === 'raw' || value === 'percentTotal' || value === 'difference') {
    return value;
  }
  return fallback;
};

const normalizeDashboardAnalysisMode = (
  value: unknown,
  fallback?: DashboardAnalysisMode,
): DashboardAnalysisMode | undefined => {
  if (
    value === 'standard' ||
    value === 'trend' ||
    value === 'histogram' ||
    value === 'rolling' ||
    value === 'outlier'
  ) {
    return value;
  }
  return fallback;
};

const normalizeTeamRole = (
  value: unknown,
): DashboardSeriesFilter['teamRole'] | undefined => {
  return value === 'team1' || value === 'team2' ? value : undefined;
};

const normalizeDashboardSeriesFilter = (
  value: unknown,
): DashboardSeriesFilter | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  return {
    team: asNonEmptyString(value.team),
    teamRole: normalizeTeamRole(value.teamRole),
    action: asNonEmptyString(value.action),
    labelGroup: asNonEmptyString(value.labelGroup),
    labelValue: asNonEmptyString(value.labelValue),
  };
};

const stripTeamFilters = (
  widget: AnalysisDashboardWidget,
): AnalysisDashboardWidget => {
  const { widgetFilters, series } = widget;
  const nextWidgetFilters = widgetFilters
    ? { ...widgetFilters, team: undefined }
    : undefined;
  const nextSeries = series
    ? series.map((entry) => ({
        ...entry,
        filters: { ...entry.filters, team: undefined },
      }))
    : undefined;
  return {
    ...widget,
    widgetFilters: nextWidgetFilters,
    series: nextSeries,
  };
};

const normalizeDashboardSeriesDefinition = (
  value: unknown,
  index: number,
): DashboardSeriesDefinition | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id) ?? `series-${index + 1}`;
  const name = asNonEmptyString(value.name) ?? `系列${index + 1}`;
  const filters = normalizeDashboardSeriesFilter(value.filters) ?? {};

  return {
    id,
    name,
    filters: {
      ...filters,
      team: undefined,
    },
  };
};

const normalizeDashboardWidget = (
  value: unknown,
  index: number,
): AnalysisDashboardWidget | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const normalized: AnalysisDashboardWidget = {
    id: asNonEmptyString(value.id) ?? `widget-${index + 1}`,
    title:
      asNonEmptyString(value.title) ??
      `${TEMPLATE_WIDGET_FALLBACK.title} ${index + 1}`,
    chartType: normalizeDashboardChartType(
      value.chartType,
      TEMPLATE_WIDGET_FALLBACK.chartType,
    ),
    metric: normalizeDashboardMetric(
      value.metric,
      TEMPLATE_WIDGET_FALLBACK.metric,
    ),
    primaryAxis: normalizeMatrixAxis(
      value.primaryAxis,
      TEMPLATE_WIDGET_FALLBACK.primaryAxis,
    ),
    seriesEnabled:
      asBoolean(value.seriesEnabled) ?? TEMPLATE_WIDGET_FALLBACK.seriesEnabled,
    seriesAxis: normalizeMatrixAxis(
      value.seriesAxis,
      TEMPLATE_WIDGET_FALLBACK.seriesAxis,
    ),
    colSpan:
      value.colSpan === 4 || value.colSpan === 6 || value.colSpan === 12
        ? value.colSpan
        : TEMPLATE_WIDGET_FALLBACK.colSpan,
  };

  const analysisMode = normalizeDashboardAnalysisMode(value.analysisMode);
  if (analysisMode) {
    normalized.analysisMode = analysisMode;
  }

  const limit = asPositiveNumber(value.limit);
  if (limit != null) {
    normalized.limit = limit;
  }

  if (value.dataMode === 'axis' || value.dataMode === 'series') {
    normalized.dataMode = value.dataMode;
  }

  const series = Array.isArray(value.series)
    ? value.series
        .map((entry, seriesIndex) =>
          normalizeDashboardSeriesDefinition(entry, seriesIndex),
        )
        .filter((entry): entry is DashboardSeriesDefinition => entry !== null)
    : [];
  if (series.length > 0) {
    normalized.series = series;
  }

  const calc = normalizeDashboardCalcMode(
    value.calc,
    TEMPLATE_WIDGET_FALLBACK.calc,
  );
  if (calc) {
    normalized.calc = calc;
  }

  const widgetFilters = normalizeDashboardSeriesFilter(value.widgetFilters);
  if (widgetFilters) {
    normalized.widgetFilters = widgetFilters;
  }

  const timeBucketSec = asPositiveNumber(value.timeBucketSec);
  if (timeBucketSec != null) {
    normalized.timeBucketSec = timeBucketSec;
  }

  const histogramBinSec = asPositiveNumber(value.histogramBinSec);
  if (histogramBinSec != null) {
    normalized.histogramBinSec = histogramBinSec;
  }

  const rollingWindow = asPositiveNumber(value.rollingWindow);
  if (rollingWindow != null) {
    normalized.rollingWindow = rollingWindow;
  }

  const outlierIqrMultiplier = asPositiveNumber(value.outlierIqrMultiplier);
  if (outlierIqrMultiplier != null) {
    normalized.outlierIqrMultiplier = outlierIqrMultiplier;
  }

  return stripTeamFilters(normalized);
};

export const normalizeDashboardList = (
  dashboards: unknown[],
): AnalysisDashboard[] => {
  return dashboards
    .filter(isPlainObject)
    .filter((item) => item.id !== 'default')
    .map((item, index) => {
      const widgets = Array.isArray(item.widgets)
        ? item.widgets
            .map((widget, widgetIndex) =>
              normalizeDashboardWidget(widget, widgetIndex),
            )
            .filter(
              (widget): widget is AnalysisDashboardWidget => widget !== null,
            )
        : [];

      const normalized = {
        id: asNonEmptyString(item.id) ?? `dashboard-${index + 1}`,
        name: asNonEmptyString(item.name) ?? `ダッシュボード${index + 1}`,
        widgets,
      };
      if (normalized.id === 'template-basic') {
        return {
          ...normalized,
          widgets: createTemplateDashboardWidgets(),
        };
      }
      return normalized;
    });
};

export const normalizeAnalysisDashboard = (
  dashboard?: unknown,
): AnalysisDashboardConfig => {
  if (!isPlainObject(dashboard)) {
    return createDefaultAnalysisDashboard();
  }

  const hasDashboards = dashboard.dashboards;
  if (Array.isArray(hasDashboards)) {
    const dashboards = hasDashboards
      .filter(isPlainObject)
      .filter((item) => Array.isArray(item.widgets))
      .filter((item) => item.id !== 'default');
    if (dashboards.length === 0) {
      return createDefaultAnalysisDashboard();
    }

    const normalizedDashboards = normalizeDashboardList(dashboards);
    const hasTemplate = normalizedDashboards.some(
      (item) => item.id === 'template-basic',
    );
    if (!hasTemplate) {
      normalizedDashboards.push({
        id: 'template-basic',
        name: '基本分析テンプレート',
        widgets: createTemplateDashboardWidgets(),
      });
    }
    const requestedActiveId = asNonEmptyString(dashboard.activeDashboardId);
    const activeId =
      normalizedDashboards.find((item) => item.id === requestedActiveId)?.id ??
      normalizedDashboards[0].id;
    return {
      dashboards: normalizedDashboards,
      activeDashboardId: activeId,
    };
  }

  const legacyWidgets = dashboard.widgets;
  if (!Array.isArray(legacyWidgets) || legacyWidgets.length === 0) {
    return createDefaultAnalysisDashboard();
  }
  return {
    dashboards: [
      {
        id: 'template-basic',
        name: '基本分析テンプレート',
        widgets: createTemplateDashboardWidgets(),
      },
    ],
    activeDashboardId: 'template-basic',
  };
};
