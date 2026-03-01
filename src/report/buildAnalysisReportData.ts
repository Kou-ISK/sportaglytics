import type { MatrixAxisConfig } from '../types/MatrixConfig';
import type {
  AnalysisDashboard,
  AnalysisDashboardConfig,
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../types/Settings';
import {
  buildCustomChartData,
  type CustomChartDatumValue,
} from '../shared/analysis/customChartData';
import { extractUniqueGroups } from '../utils/labelExtractors';
import { getTimelineTeamOrder } from '../utils/teamOrder';
import { replaceTeamPlaceholders } from '../utils/teamPlaceholder';
import { createMomentumDataFactory } from '../shared/analysis/momentum';
import { buildHierarchicalMatrix } from '../utils/matrixBuilder';
import {
  buildMatrixFilterSummaryText,
  deriveMatrixFilters,
} from '../shared/analysis/matrixFilterUtils';
import {
  buildMatrixSectionsByTeamAction,
  paginateDashboardWidgets,
} from './printLayoutUtils';
import type {
  AnalysisReportBuildContext,
  AnalysisReportCard,
  AnalysisReportData,
  DashboardWidgetReportData,
  ReportChartDatumValue,
} from './types';

const formatAxis = (axis: MatrixAxisConfig): string => {
  if (axis.type === 'group') return `group:${axis.value || '-'}`;
  if (axis.type === 'action')
    return axis.value ? `action(team:${axis.value})` : 'action';
  return axis.type;
};

const formatDashboardFilterSummary = (
  filters: DashboardSeriesFilter,
): string => {
  const parts: string[] = [];
  if (filters.team) parts.push(`team=${filters.team}`);
  if (filters.teamRole) parts.push(`teamRole=${filters.teamRole}`);
  if (filters.action) parts.push(`action=${filters.action}`);
  if (filters.labelGroup) {
    parts.push(
      filters.labelValue
        ? `label=${filters.labelGroup}:${filters.labelValue}`
        : `labelGroup=${filters.labelGroup}`,
    );
  }
  return parts.length > 0 ? parts.join(', ') : 'none';
};

const resolveActiveDashboard = (
  config?: AnalysisDashboardConfig,
): AnalysisDashboard | undefined => {
  if (!config?.dashboards || config.dashboards.length === 0) return undefined;
  return (
    config.dashboards.find((item) => item.id === config.activeDashboardId) ??
    config.dashboards[0]
  );
};

const normalizeChartDatum = (
  row: Record<string, CustomChartDatumValue>,
): Record<string, ReportChartDatumValue> => {
  const normalized: Record<string, ReportChartDatumValue> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = value.filter(
        (item): item is string => typeof item === 'string',
      );
      return;
    }
    if (typeof value === 'number' || typeof value === 'string') {
      normalized[key] = value;
      return;
    }
    normalized[key] = String(value ?? '');
  });
  return normalized;
};

const toWidgetReport = (
  widget: AnalysisDashboardWidget,
  timeline: AnalysisReportBuildContext['timeline'],
  availableGroups: string[],
  baseFilters: DashboardSeriesFilter,
  teamRoleMap: { team1?: string; team2?: string },
  teamContext: { team1Name: string; team2Name: string },
): DashboardWidgetReportData => {
  const chart = buildCustomChartData(timeline, availableGroups, {
    primaryAxis: widget.primaryAxis,
    seriesAxis: widget.seriesAxis,
    seriesEnabled: widget.seriesEnabled,
    metric: widget.metric,
    analysisMode: widget.analysisMode,
    limit: widget.limit,
    series: widget.dataMode === 'series' ? widget.series : undefined,
    calc: widget.calc,
    baseFilters,
    widgetFilters: widget.widgetFilters,
    teamRoleMap,
    timeBucketSec: widget.timeBucketSec,
    histogramBinSec: widget.histogramBinSec,
    rollingWindow: widget.rollingWindow,
    outlierIqrMultiplier: widget.outlierIqrMultiplier,
  });

  return {
    kind: 'chart',
    id: widget.id,
    title: replaceTeamPlaceholders(widget.title, teamContext),
    colSpan: widget.colSpan,
    chartType: widget.chartType,
    metric: widget.metric,
    calcMode: chart.calcMode,
    unitLabel: chart.unitLabel,
    seriesKeys: chart.seriesKeys.length > 0 ? chart.seriesKeys : ['value'],
    data: chart.data.map((row) => normalizeChartDatum(row)),
    hasData: chart.data.length > 0,
    showLegend: widget.seriesEnabled && widget.dataMode !== 'series',
  };
};

const buildDashboardCards = (
  timeline: AnalysisReportBuildContext['timeline'],
  activeDashboard?: AnalysisDashboard,
): AnalysisReportCard[] => {
  const minStart = timeline.length
    ? Math.min(...timeline.map((item) => item.startTime))
    : 0;
  const maxEnd = timeline.length
    ? Math.max(...timeline.map((item) => item.endTime))
    : 0;
  const span = Math.max(0, maxEnd - minStart);

  return [
    {
      title: 'Event Count',
      value: String(timeline.length),
      subValue: 'timeline entries',
    },
    {
      title: 'Time Span (sec)',
      value: span.toFixed(1),
      subValue: `${minStart.toFixed(1)} - ${maxEnd.toFixed(1)}`,
    },
    {
      title: 'Dashboard Widgets',
      value: String(activeDashboard?.widgets.length ?? 0),
      subValue: activeDashboard?.name || 'N/A',
    },
  ];
};

const toSpanList = (
  source: Map<string, number>,
): Array<{ key: string; span: number }> =>
  Array.from(source.entries()).map(([key, span]) => ({ key, span }));

export const buildAnalysisReportData = (
  ctx: AnalysisReportBuildContext,
): AnalysisReportData => {
  const activeDashboard = resolveActiveDashboard(ctx.analysisDashboard);

  const orderedTeams = getTimelineTeamOrder(ctx.timeline).filter(Boolean);
  const resolvedTeams =
    orderedTeams.length > 0
      ? orderedTeams
      : ctx.resolvedTeamNames.filter(Boolean);
  const team1Name = resolvedTeams[0] || 'Team1';
  const team2Name = resolvedTeams[1] || 'Team2';
  const teamRoleMap = { team1: team1Name, team2: team2Name };
  const teamContext = { team1Name, team2Name };

  const availableGroups = extractUniqueGroups(ctx.timeline);
  const dashboardFilterSummary = formatDashboardFilterSummary(
    ctx.currentDashboardFilters,
  );
  const matrixFilterSummary = buildMatrixFilterSummaryText(
    ctx.currentMatrixFilters,
  );

  const dashboardWidgets = (activeDashboard?.widgets ?? []).map((widget) =>
    toWidgetReport(
      widget,
      ctx.timeline,
      availableGroups,
      ctx.currentDashboardFilters,
      teamRoleMap,
      teamContext,
    ),
  );
  const dashboardPages = paginateDashboardWidgets(dashboardWidgets, {
    firstPageMaxRows: 2,
    nextPageMaxRows: 3,
  });

  const createMomentumData = createMomentumDataFactory(ctx.timeline);
  const momentumSegments = createMomentumData(team1Name, team2Name);
  const momentumMaxAbs = momentumSegments.length
    ? Math.max(...momentumSegments.map((item) => Math.abs(item.value)), 10)
    : 10;

  const outcomeCounts = {
    Try: 0,
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  };
  momentumSegments.forEach((segment) => {
    if (segment.outcome === 'Try') outcomeCounts.Try += 1;
    else if (segment.outcome === 'Positive') outcomeCounts.Positive += 1;
    else if (segment.outcome === 'Negative') outcomeCounts.Negative += 1;
    else outcomeCounts.Neutral += 1;
  });

  const matrixDerived = deriveMatrixFilters(
    ctx.timeline,
    ctx.currentMatrixFilters,
  );
  const matrix = buildHierarchicalMatrix(
    matrixDerived.filteredTimeline,
    ctx.currentMatrixAxes.row,
    ctx.currentMatrixAxes.column,
  );

  const values = matrix.matrix.map((row) => row.map((cell) => cell.count));
  const flattenedValues = values.flat();
  const min = flattenedValues.length ? Math.min(...flattenedValues) : 0;
  const max = flattenedValues.length ? Math.max(...flattenedValues) : 0;

  const matrixSections = buildMatrixSectionsByTeamAction({
    timeline: ctx.timeline,
    rowAxis: ctx.currentMatrixAxes.row,
    columnAxis: ctx.currentMatrixAxes.column,
    filters: ctx.currentMatrixFilters,
    maxTables: 10,
    maxRows: 12,
    maxColumns: 12,
  });

  const minStart = ctx.timeline.length
    ? Math.min(...ctx.timeline.map((item) => item.startTime))
    : 0;
  const maxEnd = ctx.timeline.length
    ? Math.max(...ctx.timeline.map((item) => item.endTime))
    : 0;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      teamName: [team1Name, team2Name].filter(Boolean).join(' / '),
      filtersSummary: `dashboard: ${dashboardFilterSummary} | matrix: ${matrixFilterSummary}`,
      timelineCount: ctx.timeline.length,
      timelineSpanSec: Math.max(0, maxEnd - minStart),
    },
    dashboard: {
      title: 'Dashboard Summary',
      activeDashboardName: activeDashboard?.name,
      cards: buildDashboardCards(ctx.timeline, activeDashboard),
      widgets: dashboardWidgets,
      pages: dashboardPages,
      filtersSummary: dashboardFilterSummary,
    },
    momentum: {
      title: 'Momentum',
      segments: momentumSegments,
      maxAbs: momentumMaxAbs,
      teamNames: [team1Name, team2Name],
      summary: `Try ${outcomeCounts.Try} / Positive ${outcomeCounts.Positive} / Negative ${outcomeCounts.Negative} / Neutral ${outcomeCounts.Neutral}`,
      hasData: momentumSegments.length > 0,
      outcomeCounts,
    },
    matrix: {
      title: 'Matrix',
      axes: {
        row: formatAxis(ctx.currentMatrixAxes.row),
        column: formatAxis(ctx.currentMatrixAxes.column),
      },
      filterSummary: matrixFilterSummary,
      rowHeaders: matrix.rowHeaders,
      columnHeaders: matrix.columnHeaders,
      rowParentSpans: toSpanList(matrix.rowParentSpans),
      colParentSpans: toSpanList(matrix.colParentSpans),
      values,
      visibleCount: matrixDerived.filteredTimeline.length,
      totalCount: ctx.timeline.length,
      sections: matrixSections,
      referenceNote:
        '完全なMatrixはクロス集計CSV/XLSXエクスポートを参照してください。',
      min,
      max,
    },
  };
};
