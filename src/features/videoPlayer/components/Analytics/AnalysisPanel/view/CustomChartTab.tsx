import React, { useMemo, useState } from 'react';
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
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { TimelineData } from '../../../../../../types/TimelineData';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { AnalysisCard } from './AnalysisCard';
import { buildCustomChartData } from './hooks/useCustomChartData';
import { CustomBarChart } from './CustomBarChart';

type MetricType = 'count' | 'duration';

interface CustomChartTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
}

const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
  type: 'group',
  value: 'all_labels',
};


export const CustomChartTab = ({
  hasData,
  timeline,
  emptyMessage,
}: CustomChartTabProps) => {
  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );

  const [primaryAxis, setPrimaryAxis] = useState<MatrixAxisConfig>(
    DEFAULT_PRIMARY_AXIS,
  );
  const [seriesEnabled, setSeriesEnabled] = useState(false);
  const [seriesAxis, setSeriesAxis] = useState<MatrixAxisConfig>(
    DEFAULT_SERIES_AXIS,
  );
  const [metric, setMetric] = useState<MetricType>('count');

  const chartState = useMemo(
    () =>
      buildCustomChartData(timeline, availableGroups, {
        primaryAxis,
        seriesAxis,
        seriesEnabled,
        metric,
      }),
    [timeline, availableGroups, primaryAxis, seriesAxis, seriesEnabled, metric],
  );

  if (!hasData || timeline.length === 0) {
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
            onChange={setPrimaryAxis}
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
                  setMetric(event.target.value as MetricType)
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
                  onChange={(event) => setSeriesEnabled(event.target.checked)}
                />
              }
              label="系列（色分け）を使う"
            />
            {seriesEnabled && (
              <MatrixAxisSelector
                label="系列軸"
                value={seriesAxis}
                onChange={setSeriesAxis}
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
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          対象データ数: {timeline.length} 件
        </Typography>
      </Stack>
    </AnalysisCard>
  );
};
