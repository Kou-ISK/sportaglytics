import React from 'react';
import { Alert, Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import type { SyncStatus } from './types';

type WizardSyncAlertProps = {
  syncStatus: SyncStatus;
};

export const WizardSyncAlert = ({ syncStatus }: WizardSyncAlertProps) => {
  if (!syncStatus.isAnalyzing) return null;

  return (
    <Alert severity="info" sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={20} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            音声同期分析中...
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {syncStatus.syncStage}
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={syncStatus.syncProgress}
        sx={{ mt: 1 }}
      />
    </Alert>
  );
};
