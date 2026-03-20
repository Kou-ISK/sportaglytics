import React from 'react';
import { Box, Typography } from '@mui/material';
import { AnalysisReportDocument } from './components/AnalysisReportDocument';
import { useAnalysisReportController } from './controllers/useAnalysisReportController';

export const AnalysisReportScreen = () => {
  const { payload } = useAnalysisReportController();

  if (!payload) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          レポートを準備中です...
        </Typography>
      </Box>
    );
  }

  return <AnalysisReportDocument payload={payload} />;
};
