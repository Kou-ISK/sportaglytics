import React, { useMemo } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { ExportProgressWindowState } from '../../types/ipc/exportProgressWindow';
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
  if (state.status === 'cancelling') return '中止処理を待っています';
  if (state.status === 'cancelled') return '中止しました';
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

export const ExportProgressView = ({
  state,
  now,
  pending,
  notice,
  onCancel,
  onClose,
}: {
  state: ExportProgressWindowState | null;
  now: number;
  pending: boolean;
  notice: string | null;
  onCancel: () => void;
  onClose: () => void;
}): React.ReactElement => {
  const progress =
    state && state.total > 0 ? (state.current / state.total) * 100 : 0;
  const remainingLabel = useMemo(() => {
    return state ? buildRemainingLabel(state, now) : '書き出し開始を待機中';
  }, [now, state]);
  const title =
    state?.status === 'cancelled'
      ? '書き出しを中止しました'
      : state?.status === 'cancelling'
        ? '書き出しを中止中'
        : state?.status === 'completed'
          ? '書き出し完了'
          : state?.status === 'failed'
            ? '書き出し失敗'
            : '映像を書き出し中';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        p: 2,
        boxSizing: 'border-box',
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          bgcolor: 'background.paper',
          p: 2,
          height: '100%',
        }}
      >
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {state?.message ?? '準備中...'}
            </Typography>
          </Stack>

          <Box>
            <LinearProgress
              data-testid="export-progress-bar"
              variant={state ? 'determinate' : 'indeterminate'}
              value={Math.min(100, Math.max(0, progress))}
              sx={{
                height: 10,
                borderRadius: 1,
                '& .MuiLinearProgress-bar': {
                  transition:
                    state?.status === 'running'
                      ? 'transform 200ms linear'
                      : 'none',
                },
              }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mt: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                {state ? '映像時間ベース' : '-'}
              </Typography>
              <Typography
                data-testid="export-progress-percent"
                variant="caption"
                color="text.secondary"
              >
                {state ? `${Math.round(progress)}%` : ''}
              </Typography>
            </Stack>
          </Box>

          <Typography variant="body2">{remainingLabel}</Typography>

          {notice && <Alert severity="info">{notice}</Alert>}
          {(state?.status === 'failed' || ((state?.status === 'cancelled' || state?.status === 'completed') && (state.retainedDirectories?.length || state.retainedLocationUnknown))) && (
            <Alert severity="error" variant="outlined">
              <AlertTitle>{state.status === 'completed' ? '出力は保存されました' : state.status === 'cancelled' ? '書き出しを中止しました' : '書き出しを完了できませんでした'}</AlertTitle>
              <Typography variant="body2">
                {state.retainedDirectories?.length || state.retainedLocationUnknown
                  ? '保存先の出力を確認するまで、再試行しないでください。'
                  : '元映像の場所、保存先の書き込み権限と空き容量を確認し、メイン画面からもう一度書き出してください。'}
              </Typography>
              {state.retainedLocationUnknown && <Typography variant="body2">一時データの場所を確認できません。自動削除や再試行は行わないでください。</Typography>}
              {state.retainedDirectories &&
                state.retainedDirectories.length > 0 && (
                  <Box>
                    <Typography variant="body2">
                      次の一時フォルダは保全されています。状態を確認するまで自動削除しないでください。
                    </Typography>
                    {state.retainedDirectories.map((record) => (
                      <Typography
                        key={record.id}
                        component="div"
                        variant="body2"
                        sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}
                      >
                        <span>{record.path}</span>（{record.purpose === 'final-staging' ? '最終保存の準備' : record.purpose === 'native-staging' ? 'コピーの準備' : '映像処理'}・{record.reason === 'publication-uncertain' ? '保存結果未確認' : record.reason === 'cleanup-failed' ? '後片付け未確認' : '処理失敗後に保持'}・書き込み状態未確認）
                      </Typography>
                    ))}
                  </Box>
                )}
              {state.error && (
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
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.7rem',
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      userSelect: 'text',
                    }}
                  >
                    {state.error}
                  </Box>
                </Box>
              )}
            </Alert>
          )}

          {state?.status === 'running' && (
            <Button variant="outlined" disabled={pending} onClick={onCancel}>
              書き出しを中止
            </Button>
          )}
          {state?.status !== 'running' && state?.status !== 'cancelling' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={onClose}>
                閉じる
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
