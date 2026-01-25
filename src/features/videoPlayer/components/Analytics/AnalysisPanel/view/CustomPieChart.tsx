import React from 'react';
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
}

export const CustomPieChart = ({
  data,
  seriesKeys,
  unitLabel,
  metric,
  height = 300,
}: CustomPieChartProps) => {
  const normalizedSeriesKeys = seriesKeys.length > 0 ? seriesKeys : ['value'];
  const pieData = data.map((entry) => {
    const total = normalizedSeriesKeys.reduce((sum, key) => {
      const value = entry[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    return {
      name: String(entry.name ?? ''),
      value: total,
    };
  });

  const totalValue = pieData.reduce((sum, entry) => sum + entry.value, 0);

  const formatValue = (value: number) => {
    if (metric === 'duration') {
      return `${value.toFixed(1)}${unitLabel}`;
    }
    return `${Math.round(value)}${unitLabel}`;
  };

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
          formatter={(value: number) => [formatValue(value), '値']}
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
