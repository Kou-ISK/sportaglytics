import type { ReactElement } from 'react';
import {
  Alert,
  Button,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
export interface NativePlaybackPanelViewProps {
  mode: 'original' | 'native' | 'restoring' | 'failed';
  unavailableReason?: string | null;
  error: string | null;
  audioTracks: number;
  audioTrack: number;
  muted: boolean;
  onOriginal: () => void;
  onAudio: (track: number) => void;
  onMute: () => void;
}
export const NativePlaybackPanelView = (
  props: NativePlaybackPanelViewProps,
): ReactElement => (
  <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Typography variant="caption" role="status">
        {props.mode === 'restoring'
          ? '原本を復元中…'
          : props.mode === 'native'
            ? 'ネイティブ再生（標準）'
            : props.mode === 'failed'
              ? '再生の復旧が必要です'
              : '互換再生'}
      </Typography>
      {(props.mode === 'failed' || props.mode === 'restoring') && (
        <Button
          disabled={props.mode === 'restoring'}
          onClick={props.onOriginal}
        >
          再生を復旧
        </Button>
      )}
      <Select
        size="small"
        value={props.audioTrack}
        disabled={props.mode === 'failed'}
        inputProps={{ 'aria-label': '音声トラック' }}
        onChange={(event) => props.onAudio(Number(event.target.value))}
      >
        {Array.from({ length: props.audioTracks }, (_, index) => (
          <MenuItem key={index} value={index}>
            音声 {index + 1}
          </MenuItem>
        ))}
      </Select>
      <Button disabled={props.mode === 'failed'} onClick={props.onMute}>
        {props.muted ? '音声を再生' : '消音'}
      </Button>
    </Stack>
    {props.mode === 'original' && props.unavailableReason && (
      <Typography variant="caption" color="text.secondary">
        {props.unavailableReason}
      </Typography>
    )}
    {props.mode === 'native' && (
      <Typography variant="caption" color="text.secondary">
        初回・遠距離のシークには待ち時間があります。過去の間欠停止と実聴取による同期確認は未解決です。
      </Typography>
    )}
    {props.error && <Alert severity="warning">{props.error}</Alert>}
  </Stack>
);
