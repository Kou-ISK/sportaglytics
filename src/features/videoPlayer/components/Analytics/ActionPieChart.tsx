import { Box, Typography } from '@mui/material';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from 'recharts';
import React from 'react';
import { rechartsData } from '../../../../types/RechartsData';

interface ActionPieChartProps {
  countActionFunction: (teamName: string, actionName: string) => rechartsData[];
  teamName: string;
  actionName: string;
}

const CUSTOM_COLORS = [
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

export const ActionPieChart = ({
  countActionFunction,
  teamName,
  actionName,
}: ActionPieChartProps) => {
  const data = countActionFunction(teamName, actionName);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (total === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {teamName}: データなし
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          mb: 1,
          fontSize: '0.85rem',
          textAlign: 'center',
        }}
      >
        {teamName}
      </Typography>
      <Box sx={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              nameKey="name"
              dataKey="value"
              startAngle={180}
              endAngle={0}
              data={data}
              cx="50%"
              cy="100%"
              innerRadius="50%"
              outerRadius="80%"
              label={({ value }) => {
                const percentage = ((value / total) * 100).toFixed(1);
                return `${percentage}% (${value})`;
              }}
              labelLine={{ stroke: '#666', strokeWidth: 1 }}
            >
              {data.map((_, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CUSTOM_COLORS[index % CUSTOM_COLORS.length]}
                />
              ))}
            </Pie>
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: '0.8rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};
