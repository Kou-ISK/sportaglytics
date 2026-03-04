import type {
  AnalysisDashboard,
  AnalysisDashboardConfig,
  AnalysisDashboardWidget,
  AppSettings,
  CodeWindowLayout,
} from './coreTypes';
import {
  createDefaultAnalysisDashboard,
  createDefaultCodeWindowLayout,
  createTemplateDashboardWidgets,
} from './defaults';

export const normalizeCodingPanelLayouts = (
  panel: NonNullable<AppSettings['codingPanel']>,
): NonNullable<AppSettings['codingPanel']> => {
  const defaultLayout = createDefaultCodeWindowLayout();
  const existing = panel as Partial<
    NonNullable<AppSettings['codingPanel']> & {
      layouts?: CodeWindowLayout[];
      activeLayoutId?: string;
    }
  >;
  const codeWindows = Array.isArray(existing.codeWindows)
    ? [...existing.codeWindows]
    : Array.isArray(existing.layouts)
      ? [...existing.layouts]
      : [];
  const idx = codeWindows.findIndex((layout) => layout.id === defaultLayout.id);
  const shouldReplace =
    idx === -1 ||
    codeWindows[idx].canvasWidth !== defaultLayout.canvasWidth ||
    codeWindows[idx].canvasHeight !== defaultLayout.canvasHeight ||
    (codeWindows[idx].buttons?.length ?? 0) !== defaultLayout.buttons.length;

  if (idx === -1) {
    codeWindows.unshift(defaultLayout);
  } else if (shouldReplace) {
    codeWindows[idx] = defaultLayout;
  }

  const activeCodeWindowId =
    existing.activeCodeWindowId ?? existing.activeLayoutId ?? defaultLayout.id;

  return {
    ...panel,
    codeWindows,
    activeCodeWindowId,
  };
};

const stripTeamFilters = (widget: AnalysisDashboardWidget): AnalysisDashboardWidget => {
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

const normalizeDashboards = (dashboards: AnalysisDashboard[]): AnalysisDashboard[] => {
  return dashboards
    .filter((item) => item.id !== 'default')
    .map((item, index) => {
      const normalized = {
        id: item.id || `dashboard-${index + 1}`,
        name: item.name || `ダッシュボード${index + 1}`,
        widgets: Array.isArray(item.widgets)
          ? item.widgets.map(stripTeamFilters)
          : [],
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
  dashboard?: AnalysisDashboardConfig | null,
): AnalysisDashboardConfig => {
  if (!dashboard) {
    return createDefaultAnalysisDashboard();
  }

  const hasDashboards = (dashboard as AnalysisDashboardConfig).dashboards;
  if (Array.isArray(hasDashboards)) {
    const dashboards = hasDashboards
      .filter((item) => item && Array.isArray(item.widgets))
      .filter((item) => item.id !== 'default');
    if (dashboards.length === 0) {
      return createDefaultAnalysisDashboard();
    }

    const normalizedDashboards = normalizeDashboards(dashboards);
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
    const activeId =
      normalizedDashboards.find(
        (item) => item.id === dashboard.activeDashboardId,
      )?.id ?? normalizedDashboards[0].id;
    return {
      dashboards: normalizedDashboards,
      activeDashboardId: activeId,
    };
  }

  const legacyWidgets = (dashboard as { widgets?: AnalysisDashboardWidget[] }).widgets;
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
