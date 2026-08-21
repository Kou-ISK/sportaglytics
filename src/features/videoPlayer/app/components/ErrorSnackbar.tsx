import React from 'react';
import { Alert, AlertTitle, Box, Snackbar, Typography } from '@mui/material';
import type { VideoPlayerError } from '../../../../types/video/error';

interface ErrorSnackbarProps {
  error: VideoPlayerError | null;
  onClose: () => void;
}

const getErrorTitle = (type: VideoPlayerError['type']): string => {
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
    open={Boolean(error)}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    sx={{ maxWidth: 'min(720px, calc(100vw - 32px))' }}
  >
    <Alert
      onClose={onClose}
      severity="error"
      variant="filled"
      sx={{ width: '100%', alignItems: 'flex-start' }}
    >
      <AlertTitle>{error ? getErrorTitle(error.type) : ''}</AlertTitle>
      <Typography variant="body2" component="div">
        {error?.message}
      </Typography>

      {error?.recoveryHint && (
        <Typography variant="body2" component="div" sx={{ mt: 0.75 }}>
          {error.recoveryHint}
        </Typography>
      )}

      {error?.detail && (
        <Box
          component="details"
          sx={{
            mt: 1,
            '& summary': {
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700,
            },
          }}
        >
          <Box component="summary">エラー詳細を表示</Box>
          <Box
            component="pre"
            sx={{
              mt: 1,
              mb: 0,
              p: 1,
              maxHeight: 160,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.7rem',
              bgcolor: 'rgba(0,0,0,0.24)',
              borderRadius: 1,
              userSelect: 'text',
            }}
          >
            {error.detail}
          </Box>
        </Box>
      )}
    </Alert>
  </Snackbar>
);
