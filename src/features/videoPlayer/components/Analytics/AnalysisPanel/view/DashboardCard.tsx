import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  chips?: string[];
  children: React.ReactNode;
}

export const DashboardCard = ({
  title,
  subtitle,
  actions,
  chips,
  children,
}: DashboardCardProps) => {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        height: '100%',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
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
          {chips && chips.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {chips.map((chip) => (
                <Typography
                  key={chip}
                  variant="caption"
                  sx={{
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 999,
                    bgcolor: 'action.hover',
                  }}
                >
                  {chip}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
        {actions && <Box>{actions}</Box>}
      </Box>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Paper>
  );
};
