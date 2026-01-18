import React from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  LinearProgress,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ExportProgressSnackbarProps {
  open: boolean;
  current: number;
  total: number;
  message?: string;
  onClose?: () => void;
}

export const ExportProgressSnackbar: React.FC<ExportProgressSnackbarProps> = ({
  open,
  current,
  total,
  message,
  onClose,
}) => {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      sx={{ maxWidth: 400 }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{ width: '100%' }}
        action={
          onClose && (
            <IconButton size="small" color="inherit" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )
        }
      >
        <AlertTitle>書き出し中</AlertTitle>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {message || `${current} / ${total} ファイル`}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{ mt: 0.5, display: 'block', opacity: 0.9 }}
          >
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};
