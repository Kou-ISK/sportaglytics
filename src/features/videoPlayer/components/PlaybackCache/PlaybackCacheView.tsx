import type { ReactElement } from 'react';
import {
  Alert,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type {
  PlaybackCacheEstimate,
  PlaybackCacheStatus,
} from '../../../../types/playbackCache';

export interface PlaybackCacheViewProps {
  status: PlaybackCacheStatus;
  estimate: PlaybackCacheEstimate | null;
  canPrepare: boolean;
  paused: boolean;
  onPrepare: () => void;
  onReuse: () => void;
  onCancel: () => void;
  onUseOriginal: () => void;
  onUseCache: () => void;
  onRetryCleanup: () => void;
}

const labels: Record<PlaybackCacheStatus['phase'], string> = {
  original: '原本で再生します。',
  converting: '再生用コピーを作成しています…',
  validating: '映像・音声の時刻を確認しています…',
  publishing: '再生用コピーを保存しています…',
  cancelling: '処理の終了を待っています…',
  ready: '再生用コピーを使用できます。',
  failed: '再生用コピーを準備できませんでした。',
};
const errors = {
  missing:
    'この原本と再生環境に合う保存済みコピーがありません。原本を使用します。必要なら新しく作成してください。',
  capacity:
    '保存先の空き容量または容量上限が不足しています。原本はそのまま再生できます。',
  validation:
    '映像・音声・再生環境の確認に合格しませんでした。原本を使用します。',
  operation: 'コピーの準備に失敗しました。原本を使用します。',
  cleanup:
    '一時ファイルの片付けが完了していません。再試行する前に片付けを完了してください。',
  stop: '変換処理の終了を確認できていません。終了を待つ間、原本は使用できます。片付けや再生成は開始しません。',
};

export const PlaybackCacheView = (
  props: PlaybackCacheViewProps,
): ReactElement => {
  const { status, estimate } = props;
  const busy = [
    'converting',
    'validating',
    'publishing',
    'cancelling',
  ].includes(status.phase);
  const cancelable =
    status.phase === 'converting' || status.phase === 'validating';
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">再生用コピー</Typography>
      <Typography variant="body2">
        原本・タグ・書き出し元は保持します。
      </Typography>
      {estimate && (
        <Typography variant="caption" color="text.secondary">
          推定 {Math.ceil(estimate.seconds / 60)}分・
          {(estimate.bytes / 1e9).toFixed(1)}GB（素材と環境により変わります）
        </Typography>
      )}
      <Typography role="status" variant="body2">
        {labels[status.phase]}
      </Typography>
      {busy && (
        <LinearProgress
          aria-label="再生用コピーの準備"
          variant={status.progress === null ? 'indeterminate' : 'determinate'}
          value={status.progress === null ? undefined : status.progress * 100}
        />
      )}
      {status.error && <Alert severity="error">{errors[status.error]}</Alert>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {!busy && status.phase !== 'ready' && status.error !== 'cleanup' && (
          <Button disabled={!props.canPrepare} onClick={props.onReuse}>
            保存済みコピーを確認
          </Button>
        )}
        {!busy && status.phase !== 'ready' && status.error !== 'cleanup' && (
          <Button disabled={!props.canPrepare} onClick={props.onPrepare}>
            再生用コピーを作成
          </Button>
        )}
        {cancelable && <Button onClick={props.onCancel}>キャンセル</Button>}
        {status.error === 'cleanup' && (
          <Button onClick={props.onRetryCleanup}>片付けを再試行</Button>
        )}
        {status.phase === 'ready' && status.selected === 'original' && (
          <Button disabled={!props.paused} onClick={props.onUseCache}>
            再生用コピーを使う
          </Button>
        )}
        {status.selected === 'cache' && (
          <Button disabled={!props.paused} onClick={props.onUseOriginal}>
            原本へ戻す
          </Button>
        )}
      </Stack>
      {status.phase === 'ready' && !props.paused && (
        <Typography variant="caption">
          一時停止してから切り替えてください。
        </Typography>
      )}
    </Stack>
  );
};
