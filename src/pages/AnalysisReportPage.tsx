import React, { useEffect, useMemo, useState } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TimelineData } from '../types/TimelineData';
import type {
  AnalysisReportMatrixSection,
  AnalysisReportPayload,
  DashboardReportPage,
  DashboardWidgetReportData,
} from '../report/types';
import { DashboardCard } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/DashboardCard';
import { CustomBarChart } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/CustomBarChart';
import { CustomPieChart } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/CustomPieChart';
import { MomentumChart } from '../features/videoPlayer/components/Analytics/MomentumChart';
import { NoDataPlaceholder } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/NoDataPlaceholder';
import { MatrixSection } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/MatrixSection';

const parseRequestIdFromHash = () => {
  const hash = globalThis.window.location.hash ?? '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query).get('requestId') ?? '';
};

const waitForStableRender = async () => {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } })
    .fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {
      // Continue rendering even if font readiness fails.
    }
  }

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTimeout(resolve, 160);
      }),
    ),
  );
};

const toMatrixCells = (values: number[][]) =>
  values.map((row) =>
    row.map((count) => ({
      count,
      entries: [] as TimelineData[],
    })),
  );

const toSpanMap = (items: Array<{ key: string; span: number }>) =>
  new Map(items.map((item) => [item.key, item.span]));

const chunkMomentumSegments = (
  segments: AnalysisReportPayload['momentum']['segments'],
) => {
  const MAX_PER_PAGE = 60;
  if (segments.length <= MAX_PER_PAGE) {
    return [segments];
  }

  const chunks: (typeof segments)[] = [];
  for (let start = 0; start < segments.length; start += MAX_PER_PAGE) {
    chunks.push(segments.slice(start, start + MAX_PER_PAGE));
  }
  return chunks;
};

const fallbackMatrixSections = (
  payload: AnalysisReportPayload,
): AnalysisReportMatrixSection[] => [
  {
    title: payload.matrix.title,
    filterKey: 'fallback',
    rowHeaders: payload.matrix.rowHeaders,
    columnHeaders: payload.matrix.columnHeaders,
    rowParentSpans: payload.matrix.rowParentSpans,
    colParentSpans: payload.matrix.colParentSpans,
    values: payload.matrix.values,
    visibleCount: payload.matrix.visibleCount,
    totalCount: payload.matrix.totalCount,
    isOthersBucket: false,
  },
];

export const AnalysisReportPage = () => {
  const theme = useTheme();
  const [payload, setPayload] = useState<AnalysisReportPayload | null>(null);
  const [requestId, setRequestId] = useState<string>(parseRequestIdFromHash());

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.on) return;

    const handler = (_event: unknown, message: unknown) => {
      const raw = message as
        | { requestId?: string; payload?: AnalysisReportPayload }
        | null
        | undefined;
      if (!raw?.payload) return;
      if (requestId && raw.requestId && raw.requestId !== requestId) return;
      if (raw.requestId) setRequestId(raw.requestId);
      setPayload(raw.payload);
    };

    api.on(
      'analysis-report:payload',
      handler as (event: unknown, args: unknown) => void,
    );
    return () => {
      api.off?.(
        'analysis-report:payload',
        handler as (event: unknown, args: unknown) => void,
      );
    };
  }, [requestId]);

  useEffect(() => {
    if (!payload || !requestId) return;
    let canceled = false;

    const notifyReady = async () => {
      await waitForStableRender();
      if (canceled) return;
      globalThis.window.electronAPI?.send?.(
        'analysis-report:render-ready',
        requestId,
      );
    };

    void notifyReady();
    return () => {
      canceled = true;
    };
  }, [payload, requestId]);

  const teamColorMap = useMemo(() => {
    if (!payload) return {};
    const [teamA, teamB] = payload.momentum.teamNames;
    const map: Record<string, string> = {
      Team1: theme.palette.team1.main,
      Team2: theme.palette.team2.main,
    };
    if (teamA) map[teamA] = theme.palette.team1.main;
    if (teamB) map[teamB] = theme.palette.team2.main;
    return map;
  }, [payload, theme.palette.team1.main, theme.palette.team2.main]);

  const dashboardPages = useMemo<DashboardReportPage[]>(() => {
    if (!payload) return [];
    if (payload.dashboard.pages.length > 0) return payload.dashboard.pages;
    return [
      {
        pageIndex: 1,
        rowCount: 0,
        widgets: payload.dashboard.widgets,
      },
    ];
  }, [payload]);

  const momentumChunks = useMemo(() => {
    if (!payload) return [];
    return chunkMomentumSegments(payload.momentum.segments);
  }, [payload]);

  const matrixSections = useMemo(() => {
    if (!payload) return [];
    if (payload.matrix.sections.length > 0) return payload.matrix.sections;
    return fallbackMatrixSections(payload);
  }, [payload]);

  if (!payload) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          レポートを準備中です...
        </Typography>
      </Box>
    );
  }

  const renderDashboardWidgets = (widgets: DashboardWidgetReportData[]) => (
    <Box
      sx={{
        mt: 1.5,
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 1.5,
      }}
    >
      {widgets.map((widget) => (
        <Box
          key={widget.id}
          className="analysis-report-card"
          sx={{ gridColumn: `span ${widget.colSpan}` }}
        >
          <DashboardCard title={widget.title}>
            {!widget.hasData ? (
              <NoDataPlaceholder message="該当データがありません。" />
            ) : widget.chartType === 'pie' ? (
              <CustomPieChart
                data={widget.data}
                seriesKeys={widget.seriesKeys}
                unitLabel={widget.unitLabel}
                metric={widget.metric}
                calcMode={widget.calcMode}
                height={240}
                teamColorMap={teamColorMap}
                disableAnimation
              />
            ) : (
              <CustomBarChart
                data={widget.data}
                seriesKeys={widget.seriesKeys}
                stacked={widget.chartType === 'stacked'}
                showLegend={widget.showLegend}
                unitLabel={widget.unitLabel}
                metric={widget.metric}
                calcMode={widget.calcMode}
                height={220}
                teamColorMap={teamColorMap}
                disableAnimation
              />
            )}
          </DashboardCard>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 4,
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html, body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .analysis-report-sheet {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .analysis-report-page-break {
            break-before: page;
            page-break-before: always;
          }

          .analysis-report-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        `}
      </style>

      <Box sx={{ width: '100%', maxWidth: 1240, mx: 'auto', px: 2, pt: 2 }}>
        <Stack spacing={2}>
          <Paper
            className="analysis-report-sheet"
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              SporTagLytics Analysis Report
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Generated: {payload.meta.generatedAt}
              </Typography>
              {payload.meta.teamName ? (
                <Typography variant="body2" color="text.secondary">
                  Teams: {payload.meta.teamName}
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                Timeline: {payload.meta.timelineCount} events /{' '}
                {payload.meta.timelineSpanSec.toFixed(1)} sec
              </Typography>
              {payload.meta.filtersSummary ? (
                <Typography variant="body2" color="text.secondary">
                  Filters: {payload.meta.filtersSummary}
                </Typography>
              ) : null}
            </Stack>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              {payload.dashboard.title}
            </Typography>
            {payload.dashboard.activeDashboardName ? (
              <Typography variant="caption" color="text.secondary">
                Dashboard: {payload.dashboard.activeDashboardName}
              </Typography>
            ) : null}

            <Box
              sx={{
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: 1.5,
              }}
            >
              {payload.dashboard.cards.map((card, index) => (
                <Box
                  key={`${card.title}-${index}`}
                  className="analysis-report-card"
                  sx={{ gridColumn: 'span 4' }}
                >
                  <DashboardCard title={card.title} subtitle={card.subValue}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {card.value}
                    </Typography>
                  </DashboardCard>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Dashboard filters: {payload.dashboard.filtersSummary}
            </Typography>
            {renderDashboardWidgets(dashboardPages[0]?.widgets ?? [])}
          </Paper>

          {dashboardPages.slice(1).map((page) => (
            <Paper
              key={`dashboard-page-${page.pageIndex}`}
              className="analysis-report-sheet analysis-report-page-break"
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {payload.dashboard.title} (Page {page.pageIndex}/
                {dashboardPages.length})
              </Typography>
              {renderDashboardWidgets(page.widgets)}
            </Paper>
          ))}

          {momentumChunks.map((chunk, index) => (
            <Paper
              key={`momentum-${index + 1}`}
              className="analysis-report-sheet analysis-report-page-break"
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {payload.momentum.title} ({index + 1}/{momentumChunks.length})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Teams: {payload.momentum.teamNames.join(' / ')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                Segments: {chunk.length}
              </Typography>
              {payload.momentum.summary ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {payload.momentum.summary}
                </Typography>
              ) : null}
              <Box sx={{ mt: 1.25, overflow: 'hidden' }}>
                <MomentumChart
                  createMomentumData={() => chunk}
                  teamNames={payload.momentum.teamNames}
                  disableAnimation
                  renderMode="print"
                />
              </Box>
            </Paper>
          ))}

          {matrixSections.length === 0 && (
            <Paper
              className="analysis-report-sheet analysis-report-page-break"
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {payload.matrix.title}
              </Typography>
              <NoDataPlaceholder message="Matrix summary data is not available." />
              <Typography variant="caption" color="text.secondary">
                {payload.matrix.referenceNote}
              </Typography>
            </Paper>
          )}

          {matrixSections.map((section, index) => (
            <Paper
              key={`matrix-${section.filterKey}-${index}`}
              className="analysis-report-sheet analysis-report-page-break"
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {payload.matrix.title}: {section.title}
              </Typography>
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  Axes: row={payload.matrix.axes.row}, column=
                  {payload.matrix.axes.column}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Filters: {payload.matrix.filterSummary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Visible: {section.visibleCount} / Total: {section.totalCount}
                </Typography>
              </Stack>

              <Box sx={{ mt: 1.25 }}>
                <MatrixSection
                  rowHeaders={section.rowHeaders}
                  columnHeaders={section.columnHeaders}
                  rowParentSpans={toSpanMap(section.rowParentSpans)}
                  colParentSpans={toSpanMap(section.colParentSpans)}
                  matrix={toMatrixCells(section.values)}
                  onDrilldown={() => {
                    // Report page is non-interactive.
                  }}
                  exportMode="print"
                />
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                {payload.matrix.referenceNote}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default AnalysisReportPage;
