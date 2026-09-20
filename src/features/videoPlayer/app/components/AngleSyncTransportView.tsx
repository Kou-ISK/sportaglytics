import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import SkipNext from '@mui/icons-material/SkipNext';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import Sync from '@mui/icons-material/Sync';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import type {
  AngleSyncCommand,
  AngleSyncSnapshot,
} from '../../../../types/ipc/angleSync';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';
import { SyncTimecodeView } from './SyncTimecodeView';

export interface AngleSyncTransportViewProps {
  state?: AngleSyncSnapshot;
  time: number;
  playing: boolean;
  hotkeys: HotkeyConfig[];
  canSync: boolean;
  onStart: () => void;
  onSeek: (time: number) => void;
  onCommand: (command: AngleSyncCommand) => void;
}

/** Shares the normal Coding toolbar and ruler; never inserts separate media lanes. */
export const AngleSyncTransportView = ({
  state,
  time,
  playing,
  hotkeys,
  canSync,
  onStart,
  onSeek,
  onCommand,
}: AngleSyncTransportViewProps): ReactElement => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const run = (command: AngleSyncCommand): void => {
    setMenuAnchor(null);
    onCommand(command);
  };
  const angleShortcuts = hotkeys
    .filter((key) => /^toggle-angle[1-8]$/.test(key.id) && !key.disabled)
    .map((key) => `${key.label}: ${key.key}`)
    .join(' / ');
  const angleName =
    state?.selected == null ? '全アングル' : state.angles[state.selected]?.name;
  return (
    <Box
      aria-label="タイムラインのアングル同期"
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        '& .MuiButton-root': { whiteSpace: 'nowrap', minWidth: 0, px: 1 },
        '& .MuiIconButton-root': { p: 0.5 },
      }}
    >
      {!state ? (
        <Button
          size="small"
          startIcon={<Sync />}
          disabled={!canSync}
          onClick={onStart}
        >
          アングル同期
        </Button>
      ) : (
        <>
          <Tooltip
            title={`Sync Point — 選択中アングルの現在のフレームを記録（S）。切替は再生時と同じ設定: ${angleShortcuts || 'ホットキー設定で割り当ててください'}`}
          >
            <span>
              <Button
                size="small"
                startIcon={<FlagOutlined />}
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
                startIcon={<Sync />}
                disabled={state.busy || !state.canAlign}
                onClick={() => onCommand({ action: 'align' })}
              >
                アングルを同期
              </Button>
            </span>
          </Tooltip>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderLeft: 1,
              borderColor: 'divider',
              pl: 0.5,
            }}
          >
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
              {playing ? (
                <Pause fontSize="small" />
              ) : (
                <PlayArrow fontSize="small" />
              )}
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
            <SyncTimecodeView
              time={time}
              disabled={state.busy}
              onSeek={onSeek}
            />
          </Box>
          <Tooltip title={`${angleName} — ${angleShortcuts}`}>
            <Typography
              variant="caption"
              noWrap
              sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}
            >
              {angleName}
            </Typography>
          </Tooltip>
          <Button
            size="small"
            disabled={state.busy || !state.changed}
            onClick={() => onCommand({ action: 'save' })}
          >
            {state.saving ? '保存中…' : '保存して閉じる'}
          </Button>
          <Tooltip title={state.message || '同期のその他の操作'}>
            <IconButton
              size="small"
              aria-label="同期のその他の操作"
              aria-haspopup="menu"
              aria-expanded={!!menuAnchor}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem
              disabled={
                state.busy ||
                state.selected === null ||
                state.angles[state.selected]?.point == null
              }
              onClick={() => run({ action: 'remove-point' })}
            >
              同期点を解除
            </MenuItem>
            <MenuItem
              disabled={
                state.busy || !state.canAlign || state.angles.length !== 2
              }
              onClick={() => run({ action: 'audio' })}
            >
              音声で微調整
            </MenuItem>
            <MenuItem
              disabled={state.busy || !state.changed}
              onClick={() => run({ action: 'reset' })}
            >
              同期をリセット
            </MenuItem>
            <MenuItem
              disabled={state.saving}
              onClick={() => run({ action: 'cancel' })}
            >
              {state.analyzing ? '解析を中止' : '変更を破棄して終了'}
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
};
