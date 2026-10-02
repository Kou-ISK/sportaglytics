import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { TimelineData } from '../../../../../../../types/timeline/core';
import type {
  AnalysisDashboardWidget,
  DashboardSeriesFilter,
} from '../../../../../../../types/settings/coreTypes';
import { replaceTeamPlaceholders } from '../../../../../../../utils/teamPlaceholder';
import { DashboardWidgetActionsView } from './DashboardWidgetActionsView';
import { DashboardCard } from '../DashboardCard';
import { buildCustomChartData } from '../../controllers/useCustomChartData';
import { CustomPieChart } from '../CustomPieChart';
import { CustomBarChart } from '../CustomBarChart';

interface DashboardWidgetGridProps {
  disableAnimation?: boolean;
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
  disableAnimation = false,
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
}: DashboardWidgetGridProps): React.JSX.Element => {
  if (widgets.length === 0) {
    return (
      <Box
        sx={{
          py: 2,
        }}
      >
        <Stack spacing={1.5} alignItems="flex-start">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            チャートはまだありません
          </Typography>
          <Typography variant="body2" color="text.secondary">
            フィルターや軸を使って、用途に合わせた可視化ができます。
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddWidget}
          >
            チャートを追加
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 1.5,
      }}
    >
      {widgets.map((widget) => {
        const resolvedWidgetTitle = replaceTeamPlaceholders(
          widget.title,
          teamContext,
        );
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

        const actions = isEditing ? (
          <DashboardWidgetActionsView
            title={resolvedWidgetTitle}
            onEdit={() => onEditWidget(widget)}
            onDuplicate={() => onDuplicateWidget(widget)}
            onMoveUp={() => onMoveWidget(widget.id, 'up')}
            onMoveDown={() => onMoveWidget(widget.id, 'down')}
            onDelete={() => onDeleteWidget(widget.id)}
          />
        ) : undefined;

        if (chart.data.length === 0) {
          return (
            <Stack
              key={widget.id}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              spacing={1}
              sx={{
                gridColumn: '1 / -1',
                minWidth: 0,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h3" variant="subtitle2">
                  {resolvedWidgetTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {timeline.length === 0
                    ? 'タイムラインに場面がありません。'
                    : 'このチャートの条件・軸に一致する場面がありません。'}
                </Typography>
              </Box>
              {actions}
            </Stack>
          );
        }

        return (
          <Box
            key={widget.id}
            sx={{
              gridColumn: { xs: 'span 12', md: `span ${widget.colSpan}` },
              minWidth: 0,
            }}
          >
            <DashboardCard title={resolvedWidgetTitle} actions={actions}>
              {widget.chartType === 'pie' ? (
                <CustomPieChart
                  disableAnimation={disableAnimation}
                  data={chart.data}
                  seriesKeys={chart.seriesKeys}
                  unitLabel={chart.unitLabel}
                  metric={widget.metric}
                  calcMode={chart.calcMode}
                  height={260}
                  teamColorMap={teamColorMap}
                  onPointSelect={(payload) =>
                    onChartPointSelect(resolvedWidgetTitle, payload)
                  }
                />
              ) : (
                <CustomBarChart
                  disableAnimation={disableAnimation}
                  data={chart.data}
                  seriesKeys={chart.seriesKeys}
                  stacked={widget.chartType === 'stacked'}
                  showLegend={
                    widget.seriesEnabled && widget.dataMode !== 'series'
                  }
                  unitLabel={chart.unitLabel}
                  metric={widget.metric}
                  calcMode={chart.calcMode}
                  height={240}
                  teamColorMap={teamColorMap}
                  onPointSelect={(payload) =>
                    onChartPointSelect(resolvedWidgetTitle, payload)
                  }
                />
              )}
            </DashboardCard>
          </Box>
        );
      })}
    </Box>
  );
};
