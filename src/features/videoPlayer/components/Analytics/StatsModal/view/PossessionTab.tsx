import React from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
import { Pie, PieChart, ResponsiveContainer, Cell, Legend } from 'recharts';
import { NoDataPlaceholder } from './NoDataPlaceholder';

interface PossessionTabProps {
  hasData: boolean;
  data: Array<{ name: string; value: number }>;
  emptyMessage: string;
}

const PIE_COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2'];

export const PossessionTab = ({
  hasData,
  data,
  emptyMessage,
}: PossessionTabProps) => {
  if (!hasData || data.length === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, mb: 2, fontSize: '0.9rem' }}
      >
        ポゼッション比較
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              outerRadius="90%"
              innerRadius="60%"
              label={({ name, value }) => {
                const percentage = ((value / total) * 100).toFixed(1);
                const teamName = name.replace(' ポゼッション', '');
                return `${teamName}: ${value.toFixed(0)}秒 (${percentage}%)`;
              }}
              labelLine={{ stroke: '#666', strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              height={36}
              wrapperStyle={{ fontSize: '0.85rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
