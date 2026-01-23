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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { TimelineData } from '../../../../../../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  extractUniqueGroups,
  getLabelByGroupWithFallback,
  getLabelsFromTimelineData,
} from '../../../../../../utils/labelExtractors';
import { MatrixAxisSelector } from './MatrixAxisSelector';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { StatsCard } from './StatsCard';

type MetricType = 'count' | 'duration';

interface CustomChartTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
}

const DEFAULT_PRIMARY_AXIS: MatrixAxisConfig = { type: 'team' };
const DEFAULT_SERIES_AXIS: MatrixAxisConfig = {
  type: 'group',
  value: 'actionResult',
};

const SERIES_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0288d1',
  '#e64a19',
  '#689f38',
  '#c2185b',
  '#0097a7',
  '#d32f2f',
];

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

  const chartState = useMemo(() => {
    if (!hasData || timeline.length === 0) {
      return { data: [], seriesKeys: [] as string[] };
    }

    const getAxisValues = (
      item: TimelineData,
      axis: MatrixAxisConfig,
    ): string[] => {
      if (axis.type === 'team') {
        return [extractTeamFromActionName(item.actionName)];
      }
      if (axis.type === 'action') {
        return [extractActionFromActionName(item.actionName)];
      }

      const groupName =
        axis.value && axis.value !== ''
          ? axis.value
          : availableGroups[0] || '';

      if (groupName === 'all_labels') {
        const labels = getLabelsFromTimelineData(item);
        if (!labels.length) return ['未設定'];
        return labels.map((label) => `${label.group}:${label.name}`);
      }

      return [getLabelByGroupWithFallback(item, groupName, '未設定')];
    };

    const metricValueForItem = (item: TimelineData) => {
      if (metric === 'duration') {
        const duration = item.endTime - item.startTime;
        return Number.isFinite(duration) ? Math.max(0, duration) : 0;
      }
      return 1;
    };

    const seriesFallback = '集計';
    const totalsByPrimary = new Map<string, Record<string, number>>();

    for (const item of timeline) {
      const primaryValues = getAxisValues(item, primaryAxis);
      const seriesValues = seriesEnabled
        ? getAxisValues(item, seriesAxis)
        : [seriesFallback];
      const metricValue = metricValueForItem(item);

      for (const primaryValue of primaryValues) {
        const bucket =
          totalsByPrimary.get(primaryValue) ?? ({} as Record<string, number>);
        for (const seriesValue of seriesValues) {
          bucket[seriesValue] = (bucket[seriesValue] || 0) + metricValue;
        }
        totalsByPrimary.set(primaryValue, bucket);
      }
    }

    const totals = Array.from(totalsByPrimary.entries()).map(
      ([label, seriesMap]) => ({
        label,
        total: Object.values(seriesMap).reduce((sum, v) => sum + v, 0),
        seriesMap,
      }),
    );

    totals.sort((a, b) => b.total - a.total);

    const seriesTotals = new Map<string, number>();
    for (const entry of totals) {
      for (const [seriesKey, value] of Object.entries(entry.seriesMap)) {
        seriesTotals.set(seriesKey, (seriesTotals.get(seriesKey) || 0) + value);
      }
    }

    const seriesKeys = Array.from(seriesTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

    const data = totals.map((entry) => ({
      name: entry.label,
      ...entry.seriesMap,
    }));

    return { data, seriesKeys };
  }, [
    hasData,
    timeline,
    primaryAxis,
    seriesAxis,
    seriesEnabled,
    metric,
    availableGroups,
  ]);

  if (!hasData || timeline.length === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  if (chartState.data.length === 0) {
    return (
      <NoDataPlaceholder message="条件に一致するデータがありませんでした。" />
    );
  }

  const unitLabel = metric === 'duration' ? '秒' : '件';
  const formatter = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${unitLabel}`;
    }
    return `${Math.round(value)}${unitLabel}`;
  };

  return (
    <StatsCard title="カスタムチャート">
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartState.data} margin={{ top: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tickFormatter={(value) =>
                  metric === 'duration' ? `${value}` : `${value}`
                }
              />
              <Tooltip formatter={(value: number) => [formatter(value)]} />
              {seriesEnabled && <Legend />}
              {chartState.seriesKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId={seriesEnabled ? 'stack' : undefined}
                  fill={
                    SERIES_COLORS[
                      Math.abs(key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) %
                        SERIES_COLORS.length
                    ]
                  }
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Typography variant="caption" color="text.secondary">
          対象データ数: {timeline.length} 件
        </Typography>
      </Stack>
    </StatsCard>
  );
};
