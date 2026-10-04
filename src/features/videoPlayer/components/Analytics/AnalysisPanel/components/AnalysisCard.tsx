import React from 'react';
import { Box, Typography } from '@mui/material';

interface AnalysisCardProps {
  title: string;
  children: React.ReactNode;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  title,
  children,
}) => {
  return (
    <Box component="section" sx={{ minWidth: 0 }}>
      <Typography
        component="h3"
        variant="subtitle2"
        sx={{ fontWeight: 600, mb: 1 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
};
