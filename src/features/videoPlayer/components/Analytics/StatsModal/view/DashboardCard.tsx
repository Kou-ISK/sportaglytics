import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardCard = ({
  title,
  subtitle,
  actions,
  children,
}: DashboardCardProps) => {
  return (
    <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
        {actions && <Box>{actions}</Box>}
      </Box>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Paper>
  );
};
