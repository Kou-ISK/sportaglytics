import React from 'react';
import { Paper, Typography } from '@mui/material';

interface NoDataPlaceholderProps {
  message: string;
}

export const NoDataPlaceholder = ({ message }: NoDataPlaceholderProps) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: 2,
      border: '1px dashed',
      borderColor: 'divider',
      p: 6,
      textAlign: 'center',
      bgcolor: 'background.default',
    }}
  >
    <Typography variant="body1" color="text.secondary">
      {message}
    </Typography>
  </Paper>
);
