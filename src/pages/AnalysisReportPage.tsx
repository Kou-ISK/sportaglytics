import React from 'react';
import { Box, Typography } from '@mui/material';
import { AnalysisReportDocument } from './analysisReport/components/AnalysisReportDocument';
import { useAnalysisReportPayload } from './analysisReport/hooks/useAnalysisReportPayload';

export const AnalysisReportPage = () => {
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

export default AnalysisReportPage;
