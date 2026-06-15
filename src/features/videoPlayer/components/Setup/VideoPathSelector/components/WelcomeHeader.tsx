import React from 'react';
import { Box, Typography } from '@mui/material';

interface WelcomeHeaderProps {
  show: boolean;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ show }) => {
  if (!show) return null;

  return (
    <Box sx={{ pt: { xs: 2, md: 3 } }}>
      <Typography variant="h4" fontWeight={800}>
        SporTagLytics
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Package workspace
      </Typography>
    </Box>
  );
};
