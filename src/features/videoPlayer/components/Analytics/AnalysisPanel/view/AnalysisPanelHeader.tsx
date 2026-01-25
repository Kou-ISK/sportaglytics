import React from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AnalysisPanelHeaderProps {
  onClose: () => void;
}

export const AnalysisPanelHeader: React.FC<AnalysisPanelHeaderProps> = ({
  onClose,
}) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" component="span">
          分析
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ダッシュボードとクロス集計で可視化できます
        </Typography>
      </Stack>
      <IconButton onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </Box>
  );
};
