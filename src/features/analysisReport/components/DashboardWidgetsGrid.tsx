import React from 'react';
import { Box } from '@mui/material';
import type { DashboardWidgetReportData } from '../../../report/types';
import {
  CustomBarChart,
  CustomPieChart,
  DashboardCard,
  NoDataPlaceholder,
} from '../../videoPlayer';

interface DashboardWidgetsGridProps {
  widgets: DashboardWidgetReportData[];
  teamColorMap: Record<string, string>;
}

export const DashboardWidgetsGrid = ({
  widgets,
  teamColorMap,
}: DashboardWidgetsGridProps) => {
  return (
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
};
