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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          outerRadius="90%"
          innerRadius="55%"
          startAngle={180}
          endAngle={0}
          cx="50%"
          cy="100%"
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
        <Tooltip
          formatter={(
            value: number,
            _label: string,
            tooltipPayload: { payload?: { rawValue?: number } },
          ) => {
            if (calcMode === 'percentTotal') {
              const rawValue = tooltipPayload?.payload?.rawValue;
              if (typeof rawValue === 'number') {
                return [
                  `${value.toFixed(1)}% (${formatRawValue(rawValue)})`,
                  '値',
                ];
              }
              return [`${value.toFixed(1)}%`, '値'];
            }
            return [formatValue(value), '値'];
          }}
          contentStyle={tooltipStyles}
          labelStyle={{ color: theme.palette.text.secondary }}
          itemStyle={{ color: theme.palette.text.primary }}
          labelFormatter={(label) => String(label)}
        />
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
