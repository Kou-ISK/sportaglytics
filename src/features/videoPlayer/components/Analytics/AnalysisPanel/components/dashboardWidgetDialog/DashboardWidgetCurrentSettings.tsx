import React from 'react';
import { Chip, Paper, Stack, Typography } from '@mui/material';
import type {
  DashboardAnalysisMode,
  DashboardChartType,
  DashboardMetric,
} from '../../../../../../../types/settings/coreTypes';
import type { MatrixAxisConfig } from '../../../../../../../types/analysis/matrix';

interface DashboardWidgetCurrentSettingsProps {
  dataMode: 'axis' | 'series';
  analysisMode: DashboardAnalysisMode;
  primaryAxis: MatrixAxisConfig;
  chartType: DashboardChartType;
  metric: DashboardMetric;
  filterSummary: string[];
  getAnalysisModeLabel: (mode: DashboardAnalysisMode) => string;
  getAxisLabel: (axis: MatrixAxisConfig) => string;
  getChartLabel: (type: DashboardChartType) => string;
}

export const DashboardWidgetCurrentSettings = ({
  dataMode,
  analysisMode,
  primaryAxis,
  chartType,
  metric,
  filterSummary,
  getAnalysisModeLabel,
  getAxisLabel,
  getChartLabel,
}: DashboardWidgetCurrentSettingsProps) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          現在の設定
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <Chip
            label={`集計: ${dataMode === 'axis' ? '単一' : '比較'}`}
            size="small"
          />
          <Chip
            label={`モード: ${getAnalysisModeLabel(analysisMode)}`}
            size="small"
          />
          <Chip label={`軸: ${getAxisLabel(primaryAxis)}`} size="small" />
          <Chip label={`チャート: ${getChartLabel(chartType)}`} size="small" />
          <Chip
            label={`単位: ${metric === 'count' ? '件数' : '所要時間'}`}
            size="small"
          />
          {filterSummary.length > 0 && (
            <Chip
              label={`絞り込み: ${filterSummary.join(' / ')}`}
              size="small"
            />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
