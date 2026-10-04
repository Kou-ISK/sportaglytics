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
}: DashboardCardProps): React.JSX.Element => {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1,
        height: '100%',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography
            component="h3"
            variant="subtitle2"
            sx={{ fontWeight: 600 }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {chips && chips.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {chips.map((chip) => (
                <Typography
                  key={chip}
                  variant="caption"
                  sx={{
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
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
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Paper>
  );
};
