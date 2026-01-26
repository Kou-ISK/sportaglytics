import React from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const PIE_COLORS = [
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

interface CustomPieChartProps {
  data: Array<Record<string, number | string>>;
  seriesKeys: string[];
  unitLabel: string;
  metric: 'count' | 'duration';
  height?: number;
  calcMode?: 'raw' | 'percentTotal' | 'difference';
}

export const CustomPieChart = ({
  data,
  seriesKeys,
  unitLabel,
  metric,
  height = 300,
  calcMode = 'raw',
}: CustomPieChartProps) => {
  const theme = useTheme();
  const normalizedSeriesKeys = seriesKeys.length > 0 ? seriesKeys : ['value'];
  const pieData = data.map((entry) => {
    const total = normalizedSeriesKeys.reduce((sum, key) => {
      const value = entry[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    const rawTotal = normalizedSeriesKeys.reduce((sum, key) => {
      const rawValue = (entry as Record<string, number | string>)[
        `__raw_${key}`
      ];
      return sum + (typeof rawValue === 'number' ? rawValue : 0);
    }, 0);
    return {
      name: String(entry.name ?? ''),
      value: total,
      rawValue:
        typeof entry.rawValue === 'number'
          ? entry.rawValue
          : rawTotal > 0
            ? rawTotal
            : undefined,
    };
  });

  const totalValue = pieData.reduce((sum, entry) => sum + entry.value, 0);

  const formatValue = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${unitLabel}`;
    }
    return `${Math.round(value)}${unitLabel}`;
  };

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

  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: number;
      payload?: { name?: string; rawValue?: number };
    }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0];
    const name = entry.name ?? entry.payload?.name ?? '';
    const value = typeof entry.value === 'number' ? entry.value : 0;
    const rawValue = entry.payload?.rawValue;
    const percentValue =
      calcMode === 'percentTotal'
        ? value
        : totalValue > 0
          ? (value / totalValue) * 100
          : 0;

    const detail =
      calcMode === 'percentTotal'
        ? typeof rawValue === 'number'
          ? `${percentValue.toFixed(1)}% (${formatRawValue(rawValue)})`
          : `${percentValue.toFixed(1)}%`
        : `${percentValue.toFixed(1)}% (${formatValue(value)})`;

    return (
      <div style={tooltipStyles}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{name}</div>
        <div style={{ color: theme.palette.text.secondary }}>{detail}</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          outerRadius="70%"
          innerRadius="45%"
          startAngle={90}
          endAngle={-270}
          cx="50%"
          cy="45%"
          paddingAngle={1}
          label={({ name, value }) => {
            if (!totalValue) return `${name}`;
            const percentage = ((value / totalValue) * 100).toFixed(1);
            return `${name}: ${percentage}%`;
          }}
          labelLine={{ stroke: '#666', strokeWidth: 1 }}
        >
          {pieData.map((entry, index) => (
            <Cell
              key={`pie-${entry.name}-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={renderTooltip} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          height={36}
          wrapperStyle={{ fontSize: '0.8rem' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
