import React from 'react';
import { Alert, AlertTitle, Snackbar } from '@mui/material';

interface ErrorState {
  type: 'file' | 'network' | 'sync' | 'playback' | 'general';
  message: string;
}

interface ErrorSnackbarProps {
  error: ErrorState | null;
  onClose: () => void;
}

const getErrorTitle = (type: ErrorState['type']) => {
  switch (type) {
    case 'file':
      return 'ファイルエラー';
    case 'network':
      return 'ネットワークエラー';
    case 'sync':
      return '音声同期エラー';
    case 'playback':
      return '再生エラー';
    default:
      return 'エラー';
  }
};

export const ErrorSnackbar: React.FC<ErrorSnackbarProps> = ({
  error,
  onClose,
}) => (
  <Snackbar
    open={!!error}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
  >
    <Alert
      onClose={onClose}
      severity="error"
      variant="filled"
      sx={{ width: '100%' }}
    >
      <AlertTitle>{error && getErrorTitle(error.type)}</AlertTitle>
      {error?.message}
    </Alert>
  </Snackbar>
);
