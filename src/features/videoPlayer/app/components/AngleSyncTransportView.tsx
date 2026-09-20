import type { ReactElement } from 'react';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import SkipNext from '@mui/icons-material/SkipNext';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Undo from '@mui/icons-material/Undo';
import type {
  AngleSyncCommand,
  AngleSyncSnapshot,
} from '../../../../types/ipc/angleSync';
import { SyncTimecodeView } from './SyncTimecodeView';

export interface AngleSyncTransportViewProps {
  state: AngleSyncSnapshot;
  time: number;
  playing: boolean;
  onSeek: (time: number) => void;
  onCommand: (command: AngleSyncCommand) => void;
}

/** Sync Point/Align Angles live in the existing timeline; there is no second seek bar. */
export const AngleSyncTransportView = ({
  state,
  time,
  playing,
  onSeek,
  onCommand,
}: AngleSyncTransportViewProps): ReactElement => (
  <Box
    aria-label="タイムラインのアングル同期"
    sx={{
      flexShrink: 0,
      bgcolor: 'background.paper',
      borderBottom: 1,
      borderColor: 'divider',
      px: 1,
      py: 0.5,
      '& .MuiButton-root': { whiteSpace: 'nowrap' },
    }}
  >
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}
    >
      <Typography variant="subtitle2" noWrap sx={{ mr: 1 }}>
        アングル同期
      </Typography>
      <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
        {state.selected === null
          ? '全アングル'
          : state.angles[state.selected]?.name}
      </Typography>
      <SyncTimecodeView time={time} disabled={state.busy} onSeek={onSeek} />
      <Tooltip title="1コマ戻る（←）">
        <span>
          <IconButton
            size="small"
            aria-label="1コマ戻る"
            disabled={state.busy || !state.frameAvailable}
            onClick={() => onCommand({ action: 'step', direction: -1 })}
          >
            <SkipPrevious fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <IconButton
        size="small"
        aria-label={playing ? '一時停止' : '再生'}
        disabled={state.busy}
        onClick={() => onCommand({ action: 'toggle' })}
      >
        {playing ? <Pause /> : <PlayArrow />}
      </IconButton>
      <Tooltip title="1コマ進む（→）">
        <span>
          <IconButton
            size="small"
            aria-label="1コマ進む"
            disabled={state.busy || !state.frameAvailable}
            onClick={() => onCommand({ action: 'step', direction: 1 })}
          >
            <SkipNext fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Sync Point（S）— タイムラインの現在位置を同期点にする">
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={state.busy || !state.canMark}
            onClick={() => onCommand({ action: 'mark' })}
          >
            同期点を設定
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Align Angles — 各アングルの同期点を揃える">
        <span>
          <Button
            size="small"
            variant="contained"
            disabled={state.busy || !state.canAlign}
            onClick={() => onCommand({ action: 'align' })}
          >
            アングルを同期
          </Button>
        </span>
      </Tooltip>
      {state.selected !== null &&
        state.angles[state.selected]?.point !== null && (
          <Button
            size="small"
            disabled={state.busy}
            onClick={() => onCommand({ action: 'remove-point' })}
          >
            同期点を解除
          </Button>
        )}
      <Tooltip title="音声で微調整">
        <span>
          <IconButton
            size="small"
            aria-label="音声で微調整"
            disabled={
              state.busy || !state.canAlign || state.angles.length !== 2
            }
            onClick={() => onCommand({ action: 'audio' })}
          >
            <GraphicEq fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="保存前の同期に戻す">
        <span>
          <IconButton
            size="small"
            aria-label="同期をリセット"
            disabled={state.busy || !state.changed}
            onClick={() => onCommand({ action: 'reset' })}
          >
            <Undo fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        disabled={state.saving}
        onClick={() => onCommand({ action: 'cancel' })}
      >
        {state.analyzing ? '解析を中止' : 'キャンセル'}
      </Button>
      <Button
        size="small"
        disabled={state.busy || !state.changed}
        onClick={() => onCommand({ action: 'save' })}
      >
        {state.saving ? '保存中…' : '保存して閉じる'}
      </Button>
    </Box>
    <Typography
      role="status"
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', pt: 0.5 }}
    >
      {state.message ||
        '1〜8でアングル切替（同じキーで全表示） · タイムラインの赤いつまみでシーク · ← → コマ送り · S 同期点'}
    </Typography>
  </Box>
);
