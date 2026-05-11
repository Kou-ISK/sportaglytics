import React from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

interface ManualSyncControlsProps {
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
}

export const ManualSyncControls: React.FC<ManualSyncControlsProps> = ({
  onApplySync,
  onCancel,
}) => {
  return (
    <Box
      sx={{
        zIndex: 1000,
        bgcolor: (theme) => theme.custom.glass.panel,
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        p: 2,
        minWidth: 400,
        maxWidth: 600,
        boxShadow: (theme) =>
          `0 4px 20px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)'}`,
      }}
    >
      <Stack spacing={2}>
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        >
          手動同期モード
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255,255,255,0.8)',
            textAlign: 'center',
          }}
        >
          各映像のシークバーを操作して同期位置を調整してください
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckCircleIcon />}
            onClick={onApplySync}
            fullWidth
            sx={{
              fontWeight: 'bold',
              py: 1.5,
            }}
          >
            この位置で同期
          </Button>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            fullWidth
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.3)',
              fontWeight: 'bold',
              py: 1.5,
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.6)',
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            キャンセル
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
