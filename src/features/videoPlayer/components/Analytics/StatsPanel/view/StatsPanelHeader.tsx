import React from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface StatsPanelHeaderProps {
  onClose: () => void;
}

export const StatsPanelHeader: React.FC<StatsPanelHeaderProps> = ({
  onClose,
}) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" component="span">
          分析ダッシュボード
        </Typography>
        <Typography variant="body2" color="text.secondary">
          タイムラインから自動集計された指標を確認できます
        </Typography>
      </Stack>
      <IconButton onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </Box>
  );
};
