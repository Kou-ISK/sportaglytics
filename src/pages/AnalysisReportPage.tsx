import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, Typography, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TimelineData } from '../types/TimelineData';
import type { AnalysisReportPayload } from '../report/types';
import { DashboardCard } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/DashboardCard';
import { CustomBarChart } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/CustomBarChart';
import { CustomPieChart } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/CustomPieChart';
import { NoDataPlaceholder } from '../features/videoPlayer/components/Analytics/AnalysisPanel/view/NoDataPlaceholder';
import { MomentumChart } from '../features/videoPlayer/components/Analytics/MomentumChart';
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
      // ignore font readiness failure and continue
    }
  }

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTimeout(resolve, 140);
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

const buildParentSpans = (
  headers: Array<{ parent: string | null; child: string }>,
) => {
  const spans = new Map<string, number>();
  headers.forEach((header) => {
    if (!header.parent) return;
    spans.set(header.parent, (spans.get(header.parent) ?? 0) + 1);
  });
  return spans;
};

const chunkMatrixColumns = (
  payload: AnalysisReportPayload['matrix'],
  maxColumnsPerChunk = 12,
) => {
  const matrixCells = toMatrixCells(payload.values);
  if (payload.columnHeaders.length <= maxColumnsPerChunk) {
    return [
      {
        index: 1,
        total: 1,
        columnHeaders: payload.columnHeaders,
        colParentSpans: buildParentSpans(payload.columnHeaders),
        matrix: matrixCells,
      },
    ];
  }

  const chunks: Array<{
    index: number;
    total: number;
    columnHeaders: Array<{ parent: string | null; child: string }>;
    colParentSpans: Map<string, number>;
    matrix: Array<Array<{ count: number; entries: TimelineData[] }>>;
  }> = [];

  for (
    let start = 0;
    start < payload.columnHeaders.length;
    start += maxColumnsPerChunk
  ) {
    const end = Math.min(
      start + maxColumnsPerChunk,
      payload.columnHeaders.length,
    );
    const columnHeaders = payload.columnHeaders.slice(start, end);
    const matrix = matrixCells.map((row) => row.slice(start, end));
    chunks.push({
      index: chunks.length + 1,
      total: Math.ceil(payload.columnHeaders.length / maxColumnsPerChunk),
      columnHeaders,
      colParentSpans: buildParentSpans(columnHeaders),
      matrix,
    });
  }

  return chunks;
};

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

      if (raw.requestId) {
        setRequestId(raw.requestId);
      }
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
    const next: Record<string, string> = {
      Team1: theme.palette.team1.main,
      Team2: theme.palette.team2.main,
    };
    if (teamA) next[teamA] = theme.palette.team1.main;
    if (teamB) next[teamB] = theme.palette.team2.main;
    return next;
  }, [payload, theme.palette.team1.main, theme.palette.team2.main]);

  const rowParentSpans = useMemo(() => {
    if (!payload) return new Map<string, number>();
    return new Map(
      payload.matrix.rowParentSpans.map((item) => [item.key, item.span]),
    );
  }, [payload]);

  const matrixChunks = useMemo(() => {
    if (!payload) return [];
    return chunkMatrixColumns(payload.matrix, 12);
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

          .analysis-report-page {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .analysis-report-page-break {
            break-before: page;
            page-break-before: always;
          }
        `}
      </style>

      <Box sx={{ width: '100%', maxWidth: 1280, mx: 'auto', px: 2, pt: 2 }}>
        <Stack spacing={2}>
          <Paper
            className="analysis-report-page"
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
          </Paper>

          <Paper
            className="analysis-report-page"
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
          >
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

            <Box
              sx={{
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: 1.5,
              }}
            >
              {payload.dashboard.widgets.map((widget) => (
                <Box
                  key={widget.id}
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
                        height={260}
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
                        height={240}
                        teamColorMap={teamColorMap}
                        disableAnimation
                      />
                    )}
                  </DashboardCard>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper
            className="analysis-report-page"
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
          >
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              {payload.momentum.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Teams: {payload.momentum.teamNames.join(' / ')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Segments: {payload.momentum.segments.length}
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
            <Box sx={{ mt: 1.5 }}>
              <MomentumChart
                createMomentumData={() => payload.momentum.segments}
                teamNames={payload.momentum.teamNames}
                disableAnimation
              />
            </Box>
          </Paper>

          {matrixChunks.map((chunk, index) => (
            <Paper
              key={`matrix-chunk-${chunk.index}`}
              className={
                index === 0
                  ? 'analysis-report-page'
                  : 'analysis-report-page analysis-report-page-break'
              }
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                {payload.matrix.title} ({chunk.index}/{chunk.total})
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
                  Visible: {payload.matrix.visibleCount} / Total:{' '}
                  {payload.matrix.totalCount}
                </Typography>
              </Stack>
              <Box sx={{ mt: 1.25 }}>
                <MatrixSection
                  rowHeaders={payload.matrix.rowHeaders}
                  columnHeaders={chunk.columnHeaders}
                  rowParentSpans={rowParentSpans}
                  colParentSpans={chunk.colParentSpans}
                  matrix={chunk.matrix}
                  onDrilldown={() => {
                    // Report page is non-interactive.
                  }}
                  exportMode="print"
                />
              </Box>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default AnalysisReportPage;
