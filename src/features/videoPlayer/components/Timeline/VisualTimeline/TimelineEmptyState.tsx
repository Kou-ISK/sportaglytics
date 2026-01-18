import React from 'react';
import { Box, Typography } from '@mui/material';

type TimelineEmptyStateProps = {
  message: string;
};

export const TimelineEmptyState = ({ message }: TimelineEmptyStateProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};
