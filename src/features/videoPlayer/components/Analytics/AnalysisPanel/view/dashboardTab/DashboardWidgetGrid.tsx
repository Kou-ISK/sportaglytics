import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import type {
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';
import { replaceTeamPlaceholders } from '../../../../../../../utils/teamPlaceholder';
import { NoDataPlaceholder } from '../NoDataPlaceholder';
import { DashboardCard } from '../DashboardCard';
import { buildCustomChartData } from '../hooks/useCustomChartData';
import { CustomPieChart } from '../CustomPieChart';
import { CustomBarChart } from '../CustomBarChart';

interface DashboardWidgetGridProps {
  widgets: AnalysisDashboardWidget[];
  isEditing: boolean;
  onAddWidget: () => void;
  onEditWidget: (widget: AnalysisDashboardWidget) => void;
  onDuplicateWidget: (widget: AnalysisDashboardWidget) => void;
  onMoveWidget: (id: string, direction: 'up' | 'down') => void;
  onDeleteWidget: (id: string) => void;
  onChartPointSelect: (
    widgetTitle: string,
    payload: {
      title: string;
      entryIds: string[];
    },
  ) => void;
  timeline: TimelineData[];
  availableGroups: string[];
  dashboardFilters: DashboardSeriesFilter;
  teamRoleMap: { team1?: string; team2?: string };
  teamContext: { team1Name: string; team2Name: string };
  teamColorMap: Record<string, string>;
}

export const DashboardWidgetGrid = ({
  widgets,
  isEditing,
  onAddWidget,
  onEditWidget,
  onDuplicateWidget,
  onMoveWidget,
  onDeleteWidget,
  onChartPointSelect,
  timeline,
  availableGroups,
  dashboardFilters,
  teamRoleMap,
  teamContext,
  teamColorMap,
}: DashboardWidgetGridProps) => {
  if (widgets.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderStyle: 'dashed',
          bgcolor: 'action.hover',
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            チャートを追加してダッシュボードを作成しましょう
          </Typography>
          <Typography variant="body2" color="text.secondary">
            フィルターや軸を使って、用途に合わせた可視化ができます。
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAddWidget}>
            チャートを追加
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 2,
      }}
    >
      {widgets.map((widget) => {
        const resolvedWidgetTitle = replaceTeamPlaceholders(widget.title, teamContext);
        const chart = buildCustomChartData(timeline, availableGroups, {
          primaryAxis: widget.primaryAxis,
          seriesAxis: widget.seriesAxis,
          seriesEnabled: widget.seriesEnabled,
          metric: widget.metric,
          analysisMode: widget.analysisMode,
          limit: widget.limit,
          series: widget.dataMode === 'series' ? widget.series : undefined,
          calc: widget.calc,
          baseFilters: dashboardFilters,
          widgetFilters: widget.widgetFilters,
          teamRoleMap,
          timeBucketSec: widget.timeBucketSec,
          histogramBinSec: widget.histogramBinSec,
          rollingWindow: widget.rollingWindow,
          outlierIqrMultiplier: widget.outlierIqrMultiplier,
        });

        return (
          <Box key={widget.id} sx={{ gridColumn: `span ${widget.colSpan}` }}>
            <DashboardCard
              title={resolvedWidgetTitle}
              actions={
                isEditing && (
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => onEditWidget(widget)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDuplicateWidget(widget)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onMoveWidget(widget.id, 'up')}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onMoveWidget(widget.id, 'down')}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDeleteWidget(widget.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )
              }
            >
              {chart.data.length === 0 ? (
                <NoDataPlaceholder message="該当データがありません。" />
              ) : widget.chartType === 'pie' ? (
                <CustomPieChart
                  data={chart.data}
                  seriesKeys={chart.seriesKeys}
                  unitLabel={chart.unitLabel}
                  metric={widget.metric}
                  height={260}
                  teamColorMap={teamColorMap}
                  onPointSelect={(payload) => onChartPointSelect(resolvedWidgetTitle, payload)}
                />
              ) : (
                <CustomBarChart
                  data={chart.data}
                  seriesKeys={chart.seriesKeys}
                  stacked={widget.chartType === 'stacked'}
                  showLegend={widget.seriesEnabled && widget.dataMode !== 'series'}
                  unitLabel={chart.unitLabel}
                  metric={widget.metric}
                  calcMode={chart.calcMode}
                  height={240}
                  teamColorMap={teamColorMap}
                  onPointSelect={(payload) => onChartPointSelect(resolvedWidgetTitle, payload)}
                />
              )}
            </DashboardCard>
          </Box>
        );
      })}
    </Box>
  );
};
