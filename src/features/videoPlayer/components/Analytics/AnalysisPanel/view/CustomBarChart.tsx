import React from 'react';
import { useTheme } from '@mui/material/styles';
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

const getSeriesColor = (key: string) => {
  const hash = Math.abs(
    key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
  );
  return SERIES_COLORS[hash % SERIES_COLORS.length];
};

interface CustomBarChartProps {
  data: Array<Record<string, number | string>>;
  seriesKeys: string[];
  stacked: boolean;
  showLegend: boolean;
  unitLabel: string;
  height?: number;
  metric: 'count' | 'duration';
  calcMode?: 'raw' | 'percentTotal' | 'difference';
}

export const CustomBarChart = ({
  data,
  seriesKeys,
  stacked,
  showLegend,
  unitLabel,
  height = 360,
  metric,
  calcMode = 'raw',
}: CustomBarChartProps) => {
  const theme = useTheme();
  const formatter = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${unitLabel}`;
    }
    return `${Math.round(value)}${unitLabel}`;
  };

  const normalizedSeriesKeys = seriesKeys.length > 0 ? seriesKeys : ['value'];
  const rawUnitLabel = metric === 'duration' ? '秒' : '件';
  const formatRawValue = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${rawUnitLabel}`;
    }
    return `${Math.round(value)}${rawUnitLabel}`;
  };

  const tooltipStyles = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
    borderRadius: 6,
    padding: '8px 12px',
  } as const;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 6 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          interval={0}
          angle={-20}
          textAnchor="end"
          height={70}
        />
        <YAxis />
        <Tooltip
          formatter={(
            value: number,
            name: string,
            tooltipPayload: { payload?: Record<string, number | string> },
          ) => {
            if (calcMode === 'percentTotal') {
              const payload = tooltipPayload?.payload ?? {};
              const rawKey = `__raw_${name}`;
              const rawValue =
                typeof payload[rawKey] === 'number'
                  ? (payload[rawKey] as number)
                  : typeof payload.rawValue === 'number'
                    ? (payload.rawValue as number)
                    : undefined;
              if (typeof rawValue === 'number') {
                return [
                  `${value.toFixed(1)}% (${formatRawValue(rawValue)})`,
                  name,
                ];
              }
              return [`${value.toFixed(1)}%`, name];
            }
            return [formatter(value), name];
          }}
          contentStyle={tooltipStyles}
          labelStyle={{ color: theme.palette.text.secondary }}
          itemStyle={{ color: theme.palette.text.primary }}
          labelFormatter={(label) => String(label)}
        />
        {showLegend && <Legend />}
        {normalizedSeriesKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId={stacked ? 'stack' : undefined}
            fill={getSeriesColor(key)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
