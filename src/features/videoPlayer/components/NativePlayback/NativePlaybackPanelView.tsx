import type { ReactElement } from 'react';
import {
  Alert,
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { VolumeOff, VolumeUp } from '@mui/icons-material';
export interface NativePlaybackPanelViewProps {
  mode: 'original' | 'native' | 'restoring' | 'failed';
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
      {(props.mode === 'restoring' || props.mode === 'failed') && (
        <Typography variant="caption" role="status">
          {props.mode === 'restoring'
            ? '再生を復旧中…'
            : '再生の復旧が必要です'}
        </Typography>
      )}
      {(props.mode === 'failed' || props.mode === 'restoring') && (
        <Button
          disabled={props.mode === 'restoring'}
          onClick={props.onOriginal}
        >
          再生を復旧
        </Button>
      )}
      <Select
        variant="standard"
        disableUnderline
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
      <IconButton
        size="small"
        aria-label={props.muted ? '音声を再生' : '消音'}
        disabled={props.mode === 'failed'}
        onClick={props.onMute}
      >
        {props.muted ? (
          <VolumeOff fontSize="small" />
        ) : (
          <VolumeUp fontSize="small" />
        )}
      </IconButton>
    </Stack>
    {props.error && <Alert severity="warning">{props.error}</Alert>}
  </Stack>
);
