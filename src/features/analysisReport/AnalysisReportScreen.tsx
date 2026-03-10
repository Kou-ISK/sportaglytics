import React from 'react';
import { Box, Typography } from '@mui/material';
import { AnalysisReportDocument } from './ui/components/AnalysisReportDocument';
import { useAnalysisReportPayload } from './ui/hooks/useAnalysisReportPayload';

export const AnalysisReportScreen = () => {
  const { payload } = useAnalysisReportPayload();

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

export default AnalysisReportScreen;
