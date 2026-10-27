import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
export interface StartStatusProps {
  busy?: boolean;
  busyMessage?: string;
  onCancelOpen?: () => void;
  error?: string;
  errorDetails?: string;
  invalidDrop?: boolean;
  onRetry?: () => void;
  onDismissError?: () => void;
}
export const StartStatusView = ({
  busy,
  busyMessage,
  onCancelOpen,
  error,
  errorDetails,
  invalidDrop = false,
  onRetry,
  onDismissError,
}: StartStatusProps): ReactElement | null => {
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const status = statusRef.current;
    if (!status || (!busy && !error)) return;
    if (!busy) status.focus({ preventScroll: true });
    status.scrollIntoView?.({ block: 'nearest' });
  }, [busy, error, errorDetails, invalidDrop]);

  if (busy)
    return (
      <Box ref={statusRef} role="status" aria-live="polite">
        <Typography variant="body2" sx={{ mb: 1 }}>
          {busyMessage ?? 'パッケージを読み込んでいます…'}
        </Typography>
        <LinearProgress aria-label="パッケージの読み込み" />
        {onCancelOpen && (
          <Button onClick={onCancelOpen}>読み込みをキャンセル</Button>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    );
  if (!error) return null;
  return (
    <Alert
      ref={statusRef}
      tabIndex={-1}
      severity="error"
      closeText="閉じる"
      onClose={onDismissError}
      sx={{ '& .MuiAlert-message': { minWidth: 0, width: '100%' } }}
    >
      <AlertTitle>
        {invalidDrop
          ? 'ドロップしたファイルを確認してください'
          : 'パッケージを開けませんでした'}
      </AlertTitle>
      {error}
      {!invalidDrop && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          ファイルの移動や外付けドライブの接続を確認し、もう一度お試しください。別の場所から開き直すこともできます。
        </Typography>
      )}
      {errorDetails && (
        <Box
          component="details"
          sx={{ mt: 1, overflowWrap: 'anywhere', userSelect: 'text' }}
        >
          <summary>詳細を表示</summary>
          <Typography
            component="pre"
            variant="caption"
            sx={{ whiteSpace: 'pre-wrap' }}
          >
            {errorDetails}
          </Typography>
        </Box>
      )}
      <Stack direction="row" sx={{ mt: 1 }}>
        <Button color="inherit" onClick={onRetry}>
          {invalidDrop ? 'パッケージを選んで開く' : 'もう一度開く'}
        </Button>
      </Stack>
    </Alert>
  );
};
