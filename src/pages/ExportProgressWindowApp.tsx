import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { ExportProgressWindowState } from '../types/ipc/exportProgressWindow';
import {
  requestClipExportProgressWindowState,
  subscribeClipExportProgressWindowState,
} from '../shared/clipExport/clipExportGateway';

const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  if (minutes <= 0) {
    return `${restSeconds}秒`;
  }

  return `${minutes}分${String(restSeconds).padStart(2, '0')}秒`;
};

const buildRemainingLabel = (
  state: ExportProgressWindowState,
  now: number,
): string => {
  if (state.status === 'completed') {
    return `所要時間 ${formatDuration((state.completedAt ?? now) - state.startedAt)}`;
  }
  if (state.status === 'failed') {
    return '書き出しに失敗しました';
  }
  if (state.current <= 0 || state.total <= 0) {
    return '残り時間を計算中';
  }

  const elapsed = now - state.startedAt;
  const estimatedTotal = elapsed / (state.current / state.total);
  return `残り約 ${formatDuration(estimatedTotal - elapsed)}`;
};

export const ExportProgressWindowApp = (): React.ReactElement => {
  const [state, setState] = useState<ExportProgressWindowState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsubscribe = subscribeClipExportProgressWindowState(setState);
    void requestClipExportProgressWindowState().then((latest) => {
      if (latest) {
        setState(latest);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = state && state.total > 0 ? (state.current / state.total) * 100 : 0;
  const remainingLabel = useMemo(() => {
    return state ? buildRemainingLabel(state, now) : '書き出し開始を待機中';
  }, [now, state]);
  const title =
    state?.status === 'completed'
      ? '書き出し完了'
      : state?.status === 'failed'
        ? '書き出し失敗'
        : '映像を書き出し中';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#111',
        color: '#fff',
        p: 2,
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#1c1c1c',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 2,
          p: 2,
          height: '100%',
        }}
      >
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.72)">
              {state?.message ?? '準備中...'}
            </Typography>
          </Stack>

          <Box>
            <LinearProgress
              variant={state ? 'determinate' : 'indeterminate'}
              value={Math.min(100, Math.max(0, progress))}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
              <Typography variant="caption" color="rgba(255,255,255,0.72)">
                {state ? `${state.current} / ${state.total}` : '-'}
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.72)">
                {state ? `${Math.round(progress)}%` : ''}
              </Typography>
            </Stack>
          </Box>

          <Typography variant="body2">{remainingLabel}</Typography>
          {state?.error && (
            <Typography variant="caption" color="#ff8a80">
              {state.error}
            </Typography>
          )}

          {state?.status !== 'running' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => window.close()}>
                閉じる
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
