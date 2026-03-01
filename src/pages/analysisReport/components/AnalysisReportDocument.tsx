import React, { useMemo } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { AnalysisReportPayload, DashboardReportPage } from '../../../report/types';
import { DashboardCard } from '../../../features/videoPlayer';
import { AnalysisReportPrintStyles } from './AnalysisReportPrintStyles';
import { DashboardWidgetsGrid } from './DashboardWidgetsGrid';
import { MatrixSectionsReport } from './MatrixSectionsReport';
import { MomentumSectionsReport } from './MomentumSectionsReport';

interface AnalysisReportDocumentProps {
  payload: AnalysisReportPayload;
}

export const AnalysisReportDocument = ({ payload }: AnalysisReportDocumentProps) => {
  const theme = useTheme();

  const teamColorMap = useMemo(() => {
    const [teamA, teamB] = payload.momentum.teamNames;
    const map: Record<string, string> = {
      Team1: theme.palette.team1.main,
      Team2: theme.palette.team2.main,
    };
    if (teamA) map[teamA] = theme.palette.team1.main;
    if (teamB) map[teamB] = theme.palette.team2.main;
    return map;
  }, [payload.momentum.teamNames, theme.palette.team1.main, theme.palette.team2.main]);

  const dashboardPages = useMemo<DashboardReportPage[]>(() => {
    if (payload.dashboard.pages.length > 0) {
      return payload.dashboard.pages;
    }
    return [
      {
        pageIndex: 1,
        rowCount: 0,
        widgets: payload.dashboard.widgets,
      },
    ];
  }, [payload.dashboard.pages, payload.dashboard.widgets]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 4,
      }}
    >
      <AnalysisReportPrintStyles />
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
            <DashboardWidgetsGrid
              widgets={dashboardPages[0]?.widgets ?? []}
              teamColorMap={teamColorMap}
            />
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
              <DashboardWidgetsGrid
                widgets={page.widgets}
                teamColorMap={teamColorMap}
              />
            </Paper>
          ))}

          <MomentumSectionsReport payload={payload} />
          <MatrixSectionsReport payload={payload} />
        </Stack>
      </Box>
    </Box>
  );
};
