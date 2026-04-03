import type { MatrixAxisConfig } from '../MatrixConfig';
import type {
  ActionLink,
  AnalysisDashboard,
  AnalysisDashboardConfig,
  AnalysisDashboardWidget,
  AppSettings,
  ButtonLink,
  CodeWindowButton,
  CodeWindowLayout,
  DashboardAnalysisMode,
  DashboardCalcMode,
  DashboardChartType,
  DashboardMetric,
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
  HotkeyConfig,
  TeamArea,
  ThemeMode,
} from './coreTypes';
import {
  DEFAULT_SETTINGS,
  createDefaultAnalysisDashboard,
  createDefaultCodeWindowLayout,
  createTemplateDashboardWidgets,
} from './defaults';

type UnknownRecord = Record<string, unknown>;

type LegacyCodingPanel = UnknownRecord & {
  codeWindows?: unknown;
  layouts?: unknown;
  activeCodeWindowId?: unknown;
  activeLayoutId?: unknown;
};

const TEMPLATE_WIDGET_FALLBACK = createTemplateDashboardWidgets()[0];

const isPlainObject = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const asFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const asPositiveNumber = (value: unknown): number | undefined => {
  const normalized = asFiniteNumber(value);
  return normalized != null && normalized > 0 ? normalized : undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const cloneHotkey = (hotkey: HotkeyConfig): HotkeyConfig => ({
  ...hotkey,
});

const cloneButton = (button: CodeWindowButton): CodeWindowButton => ({
  ...button,
});

const cloneButtonLink = (link: ButtonLink): ButtonLink => ({
  ...link,
});

const cloneActionLink = (link: ActionLink): ActionLink => ({
  ...link,
});

const cloneTeamArea = (area: TeamArea): TeamArea => ({
  ...area,
});

const cloneCodeWindowLayout = (layout: CodeWindowLayout): CodeWindowLayout => ({
  ...layout,
  buttons: layout.buttons.map(cloneButton),
  ...(layout.buttonLinks
    ? { buttonLinks: layout.buttonLinks.map(cloneButtonLink) }
    : {}),
  ...(layout.team1Area ? { team1Area: cloneTeamArea(layout.team1Area) } : {}),
  ...(layout.team2Area ? { team2Area: cloneTeamArea(layout.team2Area) } : {}),
});

const getDefaultCodingPanel = (): NonNullable<AppSettings['codingPanel']> => {
  const fallbackDefaultLayout = createDefaultCodeWindowLayout();
  const defaultPanel = DEFAULT_SETTINGS.codingPanel;

  return {
    defaultMode: defaultPanel?.defaultMode ?? 'code',
    toolbars: (defaultPanel?.toolbars ?? []).map((toolbar) => ({ ...toolbar })),
    actionLinks: (defaultPanel?.actionLinks ?? []).map(cloneActionLink),
    codeWindows: (defaultPanel?.codeWindows ?? [fallbackDefaultLayout]).map(
      cloneCodeWindowLayout,
    ),
    activeCodeWindowId:
      defaultPanel?.activeCodeWindowId ?? fallbackDefaultLayout.id,
  };
};

const getDefaultAiAnalysis = (): NonNullable<AppSettings['aiAnalysis']> => ({
  provider: DEFAULT_SETTINGS.aiAnalysis?.provider ?? 'llama.cpp',
  baseUrl: DEFAULT_SETTINGS.aiAnalysis?.baseUrl ?? 'http://localhost:11434',
  model: DEFAULT_SETTINGS.aiAnalysis?.model ?? 'auto',
  temperature: DEFAULT_SETTINGS.aiAnalysis?.temperature ?? 0.2,
  topK: DEFAULT_SETTINGS.aiAnalysis?.topK ?? 40,
  embeddingEnabled: DEFAULT_SETTINGS.aiAnalysis?.embeddingEnabled ?? false,
  teamLabelGroup: DEFAULT_SETTINGS.aiAnalysis?.teamLabelGroup ?? '',
  retrieverPreset: DEFAULT_SETTINGS.aiAnalysis?.retrieverPreset ?? 'balanced',
});

const normalizeThemeMode = (value: unknown): ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_SETTINGS.themeMode;
};

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

const normalizeDashboards = (dashboards: unknown[]): AnalysisDashboard[] => {
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

const normalizeTeamArea = (value: unknown): TeamArea | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const x = asFiniteNumber(value.x);
  const y = asFiniteNumber(value.y);
  const width = asPositiveNumber(value.width);
  const height = asPositiveNumber(value.height);

  if (x == null || y == null || width == null || height == null) {
    return undefined;
  }

  return {
    x,
    y,
    width,
    height,
  };
};

const normalizeButtonLinkType = (
  value: unknown,
): ButtonLink['type'] | undefined => {
  return value === 'exclusive' ||
    value === 'deactivate' ||
    value === 'activate' ||
    value === 'sequence'
    ? value
    : undefined;
};

const normalizeActionLinkType = (
  value: unknown,
): ActionLink['type'] | undefined => {
  return value === 'exclusive' || value === 'deactivate' || value === 'activate'
    ? value
    : undefined;
};

const normalizeCodeWindowButton = (value: unknown): CodeWindowButton | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const type =
    value.type === 'action' || value.type === 'label' ? value.type : undefined;
  const name = asNonEmptyString(value.name);
  const x = asFiniteNumber(value.x);
  const y = asFiniteNumber(value.y);
  const width = asPositiveNumber(value.width);
  const height = asPositiveNumber(value.height);

  if (!id || !type || !name || x == null || y == null || !width || !height) {
    return null;
  }

  const normalized: CodeWindowButton = {
    id,
    type,
    name,
    x,
    y,
    width,
    height,
  };

  const labelValue = asNonEmptyString(value.labelValue);
  if (labelValue) {
    normalized.labelValue = labelValue;
  }

  const color = asNonEmptyString(value.color);
  if (color) {
    normalized.color = color;
  }

  const textColor = asNonEmptyString(value.textColor);
  if (textColor) {
    normalized.textColor = textColor;
  }

  if (
    value.textAlign === 'left' ||
    value.textAlign === 'center' ||
    value.textAlign === 'right'
  ) {
    normalized.textAlign = value.textAlign;
  }

  const borderRadius = asFiniteNumber(value.borderRadius);
  if (borderRadius != null) {
    normalized.borderRadius = borderRadius;
  }

  const hotkey = asNonEmptyString(value.hotkey);
  if (hotkey) {
    normalized.hotkey = hotkey;
  }

  if (
    value.team === 'team1' ||
    value.team === 'team2' ||
    value.team === 'shared'
  ) {
    normalized.team = value.team;
  }

  const groupId = asNonEmptyString(value.groupId);
  if (groupId) {
    normalized.groupId = groupId;
  }

  const fontSize = asPositiveNumber(value.fontSize);
  if (fontSize != null) {
    normalized.fontSize = fontSize;
  }

  return normalized;
};

const normalizeButtonLink = (value: unknown): ButtonLink | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const fromButtonId = asNonEmptyString(value.fromButtonId);
  const toButtonId = asNonEmptyString(value.toButtonId);
  const type = normalizeButtonLinkType(value.type);

  if (!id || !fromButtonId || !toButtonId || !type) {
    return null;
  }

  return {
    id,
    fromButtonId,
    toButtonId,
    type,
  };
};

const normalizeActionLink = (value: unknown): ActionLink | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const from = asNonEmptyString(value.from);
  const to = asNonEmptyString(value.to);
  const type = normalizeActionLinkType(value.type);

  if (!id || !from || !to || !type) {
    return null;
  }

  const description = asNonEmptyString(value.description);

  return {
    id,
    from,
    to,
    type,
    ...(description ? { description } : {}),
  };
};

const normalizeCodeWindowLayout = (
  value: unknown,
  index: number,
): CodeWindowLayout | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const canvasWidth = asPositiveNumber(value.canvasWidth);
  const canvasHeight = asPositiveNumber(value.canvasHeight);

  if (canvasWidth == null || canvasHeight == null) {
    return null;
  }

  const buttons = Array.isArray(value.buttons)
    ? value.buttons
        .map((button) => normalizeCodeWindowButton(button))
        .filter((button): button is CodeWindowButton => button !== null)
    : [];

  const normalized: CodeWindowLayout = {
    id: asNonEmptyString(value.id) ?? `code-window-${index + 1}`,
    name: asNonEmptyString(value.name) ?? `コードウィンドウ ${index + 1}`,
    canvasWidth,
    canvasHeight,
    buttons,
  };

  const buttonLinks = Array.isArray(value.buttonLinks)
    ? value.buttonLinks
        .map((link) => normalizeButtonLink(link))
        .filter((link): link is ButtonLink => link !== null)
    : [];
  if (buttonLinks.length > 0) {
    normalized.buttonLinks = buttonLinks;
  }

  const splitByTeam = asBoolean(value.splitByTeam);
  if (splitByTeam != null) {
    normalized.splitByTeam = splitByTeam;
  }

  const team1Area = normalizeTeamArea(value.team1Area);
  if (team1Area) {
    normalized.team1Area = team1Area;
  }

  const team2Area = normalizeTeamArea(value.team2Area);
  if (team2Area) {
    normalized.team2Area = team2Area;
  }

  return normalized;
};

export const normalizeCodingPanelLayouts = (
  panel: NonNullable<AppSettings['codingPanel']>,
): NonNullable<AppSettings['codingPanel']> => {
  const defaultLayout = createDefaultCodeWindowLayout();
  const codeWindows = Array.isArray(panel.codeWindows)
    ? panel.codeWindows.map(cloneCodeWindowLayout)
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

  const requestedActiveId = panel.activeCodeWindowId;
  const activeCodeWindowId = codeWindows.some(
    (layout) => layout.id === requestedActiveId,
  )
    ? requestedActiveId
    : defaultLayout.id;

  return {
    ...panel,
    codeWindows,
    activeCodeWindowId,
  };
};

const normalizeCodingPanel = (
  value: unknown,
): NonNullable<AppSettings['codingPanel']> => {
  const defaults = getDefaultCodingPanel();
  if (!isPlainObject(value)) {
    return normalizeCodingPanelLayouts(defaults);
  }

  const legacyPanel = value as LegacyCodingPanel;
  const rawCodeWindows: unknown[] = Array.isArray(legacyPanel.codeWindows)
    ? legacyPanel.codeWindows
    : Array.isArray(legacyPanel.layouts)
      ? legacyPanel.layouts
      : (defaults.codeWindows ?? []);
  const codeWindows = rawCodeWindows
    .map((layout, index) => normalizeCodeWindowLayout(layout, index))
    .filter((layout): layout is CodeWindowLayout => layout !== null);

  return normalizeCodingPanelLayouts({
    defaultMode:
      value.defaultMode === 'label' || value.defaultMode === 'code'
        ? value.defaultMode
        : defaults.defaultMode,
    toolbars: Array.isArray(value.toolbars)
      ? value.toolbars
          .filter(isPlainObject)
          .map((toolbar, index) => {
            const id = asNonEmptyString(toolbar.id) ?? `toolbar-${index + 1}`;
            const label =
              asNonEmptyString(toolbar.label) ?? `ツールバー ${index + 1}`;
            const mode =
              toolbar.mode === 'code' || toolbar.mode === 'label'
                ? toolbar.mode
                : null;
            const enabled = asBoolean(toolbar.enabled);

            if (mode == null || enabled == null) {
              return null;
            }

            return {
              id,
              label,
              mode,
              enabled,
              ...(toolbar.plugin === 'matrix' ||
              toolbar.plugin === 'script' ||
              toolbar.plugin === 'organizer'
                ? { plugin: toolbar.plugin }
                : {}),
            };
          })
          .filter(
            (
              toolbar,
            ): toolbar is NonNullable<
              AppSettings['codingPanel']
            >['toolbars'][number] => toolbar !== null,
          )
      : defaults.toolbars,
    actionLinks: Array.isArray(value.actionLinks)
      ? value.actionLinks
          .map((link) => normalizeActionLink(link))
          .filter((link): link is ActionLink => link !== null)
      : defaults.actionLinks,
    codeWindows: codeWindows.length > 0 ? codeWindows : defaults.codeWindows,
    activeCodeWindowId:
      asNonEmptyString(legacyPanel.activeCodeWindowId) ??
      asNonEmptyString(legacyPanel.activeLayoutId) ??
      defaults.activeCodeWindowId,
  });
};

const normalizeHotkeys = (value: unknown): HotkeyConfig[] => {
  const defaults = DEFAULT_SETTINGS.hotkeys.map(cloneHotkey);
  const defaultById = new Map(defaults.map((hotkey) => [hotkey.id, hotkey]));
  if (!Array.isArray(value)) {
    return defaults;
  }

  const normalized: HotkeyConfig[] = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    if (!isPlainObject(entry)) {
      return;
    }

    const id = asNonEmptyString(entry.id);
    if (!id || seen.has(id)) {
      return;
    }

    const fallback = defaultById.get(id);
    if (!fallback) {
      return;
    }

    const disabled = asBoolean(entry.disabled);
    normalized.push({
      id,
      label: asNonEmptyString(entry.label) ?? fallback.label,
      key: asNonEmptyString(entry.key) ?? fallback.key,
      ...(disabled != null
        ? { disabled }
        : fallback.disabled != null
          ? { disabled: fallback.disabled }
          : {}),
    });
    seen.add(id);
  });

  const missingDefaults = defaults.filter((hotkey) => !seen.has(hotkey.id));
  return normalized.length > 0 ? [...normalized, ...missingDefaults] : defaults;
};

const normalizeOverlayClip = (value: unknown): AppSettings['overlayClip'] => {
  const defaults = DEFAULT_SETTINGS.overlayClip;
  if (!isPlainObject(value)) {
    return { ...defaults };
  }

  return {
    enabled: asBoolean(value.enabled) ?? defaults.enabled,
    showActionName: asBoolean(value.showActionName) ?? defaults.showActionName,
    showActionIndex:
      asBoolean(value.showActionIndex) ?? defaults.showActionIndex,
    showLabels: asBoolean(value.showLabels) ?? defaults.showLabels,
    showMemo: asBoolean(value.showMemo) ?? defaults.showMemo,
  };
};

const normalizeAiAnalysis = (
  value: unknown,
): NonNullable<AppSettings['aiAnalysis']> => {
  const defaults = getDefaultAiAnalysis();
  if (!isPlainObject(value)) {
    return defaults;
  }

  const retrieverPreset =
    value.retrieverPreset === 'balanced' ||
    value.retrieverPreset === 'labels' ||
    value.retrieverPreset === 'memo' ||
    value.retrieverPreset === 'time'
      ? value.retrieverPreset
      : defaults.retrieverPreset;

  return {
    provider: 'llama.cpp',
    baseUrl: asNonEmptyString(value.baseUrl) ?? defaults.baseUrl,
    model: asNonEmptyString(value.model) ?? defaults.model,
    temperature: asFiniteNumber(value.temperature) ?? defaults.temperature,
    topK: asFiniteNumber(value.topK) ?? defaults.topK,
    embeddingEnabled:
      asBoolean(value.embeddingEnabled) ?? defaults.embeddingEnabled,
    teamLabelGroup:
      asNonEmptyString(value.teamLabelGroup) ?? defaults.teamLabelGroup,
    retrieverPreset,
  };
};

export const normalizeAppSettings = (value: unknown): AppSettings => {
  const settings = isPlainObject(value) ? value : {};

  return {
    themeMode: normalizeThemeMode(settings.themeMode),
    hotkeys: normalizeHotkeys(settings.hotkeys),
    language: asNonEmptyString(settings.language) ?? DEFAULT_SETTINGS.language,
    overlayClip: normalizeOverlayClip(settings.overlayClip),
    codingPanel: normalizeCodingPanel(settings.codingPanel),
    analysisDashboard: normalizeAnalysisDashboard(settings.analysisDashboard),
    aiAnalysis: normalizeAiAnalysis(settings.aiAnalysis),
  };
};
