import React from 'react';
import { Paper, Typography } from '@mui/material';

interface AnalysisCardProps {
  title: string;
  children: React.ReactNode;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  title,
  children,
}) => {
  return (
    <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
};
