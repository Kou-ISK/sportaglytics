import React from 'react';
import {
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { CustomChartData } from '../../../../../../shared/analysis/customChartData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { AnalysisCard } from './AnalysisCard';
import { CustomBarChart } from './CustomBarChart';

export type MetricType = 'count' | 'duration';

export interface CustomChartTabViewProps {
  hasData: boolean;
  emptyMessage: string;
  timelineCount: number;
  availableGroups: string[];
  teamColorMap: Record<string, string>;
  primaryAxis: MatrixAxisConfig;
  seriesEnabled: boolean;
  seriesAxis: MatrixAxisConfig;
  metric: MetricType;
  chartState: CustomChartData;
  onPrimaryAxisChange: (value: MatrixAxisConfig) => void;
  onSeriesEnabledChange: (value: boolean) => void;
  onSeriesAxisChange: (value: MatrixAxisConfig) => void;
  onMetricChange: (value: MetricType) => void;
}

export const CustomChartTabView: React.FC<CustomChartTabViewProps> = ({
  hasData,
  emptyMessage,
  timelineCount,
  availableGroups,
  teamColorMap,
  primaryAxis,
  seriesEnabled,
  seriesAxis,
  metric,
  chartState,
  onPrimaryAxisChange,
  onSeriesEnabledChange,
  onSeriesAxisChange,
  onMetricChange,
}) => {
  if (!hasData || timelineCount === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  if (chartState.data.length === 0) {
    return (
      <NoDataPlaceholder message="条件に一致するデータがありませんでした。" />
    );
  }

  const unitLabel = metric === 'duration' ? '秒' : '件';

  return (
    <AnalysisCard title="カスタムチャート">
      <Stack spacing={2}>
        <Divider />

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
          <MatrixAxisSelector
            label="X軸"
            value={primaryAxis}
            onChange={onPrimaryAxisChange}
            availableGroups={availableGroups}
          />
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="custom-metric-label">集計単位</InputLabel>
              <Select
                labelId="custom-metric-label"
                value={metric}
                label="集計単位"
                onChange={(event) =>
                  onMetricChange(event.target.value as MetricType)
                }
              >
                <MenuItem value="count">件数</MenuItem>
                <MenuItem value="duration">所要時間</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={seriesEnabled}
                  onChange={(event) =>
                    onSeriesEnabledChange(event.target.checked)
                  }
                />
              }
              label="系列（色分け）を使う"
            />
            {seriesEnabled && (
              <MatrixAxisSelector
                label="系列軸"
                value={seriesAxis}
                onChange={onSeriesAxisChange}
                availableGroups={availableGroups}
              />
            )}
          </Stack>
        </Box>

        <Box sx={{ height: 420 }}>
          <CustomBarChart
            data={chartState.data}
            seriesKeys={chartState.seriesKeys}
            stacked={false}
            showLegend={seriesEnabled}
            unitLabel={unitLabel}
            metric={metric}
            calcMode={chartState.calcMode}
            height={420}
            teamColorMap={teamColorMap}
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          対象データ数: {timelineCount} 件
        </Typography>
      </Stack>
    </AnalysisCard>
  );
};
