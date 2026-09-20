import type { ReactElement } from 'react';
import type { RefObject } from 'react';
import {
  Alert,
  Box,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Replay from '@mui/icons-material/Replay';
import Forward from '@mui/icons-material/Forward';
import type { RuntimeSyncClip } from '../hooks/sync/useClipTimelineSyncController';
import { formatSyncTime } from '../hooks/sync/clipSyncPresentation';

export interface ClipSyncPreviewViewProps {
  label: string;
  id: string;
  clipId: string;
  clips: RuntimeSyncClip[];
  active: boolean;
  busy: boolean;
  ready: boolean;
  playing: boolean;
  time: number;
  duration: number;
  error: string;
  frameRate: number;
  containerRef?: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onSelect: (id: string) => void;
  onActivate: () => void;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onStep: (seconds: number) => void;
}

export const ClipSyncPreviewView = (
  props: ClipSyncPreviewViewProps,
): ReactElement => {
  const {
    label,
    id,
    clipId,
    clips,
    active,
    busy,
    ready,
    playing,
    time,
    duration,
    error,
    frameRate,
  } = props;
  return (
    <Box
      component="section"
      tabIndex={0}
      aria-label={`${label}プレビュー`}
      onPointerDown={(event) => {
        props.onActivate();
        if (event.target instanceof HTMLVideoElement)
          event.currentTarget.focus({ preventScroll: true });
      }}
      onFocus={props.onActivate}
      sx={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 1, bgcolor: 'background.paper' }}>
        <FormControl size="small" fullWidth disabled={busy}>
          <InputLabel id={`${id}-label`}>{label}クリップ</InputLabel>
          <Select
            labelId={`${id}-label`}
            label={`${label}クリップ`}
            value={clipId}
            onChange={(event) => props.onSelect(event.target.value)}
          >
            {clips.map((clip) => (
              <MenuItem key={clip.id} value={clip.id}>
                {clip.angleName} — {clip.source.split(/[\\/]/).pop()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box
        ref={props.containerRef}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 140,
          bgcolor: (theme) => theme.custom.tokens.media.surface,
          '& .video-js': {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          },
          '& .vjs-tech': { objectFit: 'contain' },
        }}
      >
        <video
          ref={props.videoRef}
          id={id}
          className="video-js"
          preload="auto"
          playsInline
        />
      </Box>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : !ready && clipId ? (
        <LinearProgress aria-label={`${label}映像を読み込み中`} />
      ) : null}
      <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'background.paper' }}>
        <Slider
          size="small"
          aria-label={`${label}映像の再生位置`}
          min={0}
          max={duration || 1}
          step={0.001}
          value={Math.min(time, duration || 1)}
          disabled={!ready || busy}
          onChange={(_, value) => {
            if (typeof value === 'number') props.onSeek(value);
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.25}
          sx={{ minWidth: 0 }}
        >
          <Tooltip title="1秒戻る">
            <span>
              <IconButton
                size="small"
                aria-label={`${label}: 1秒戻る`}
                disabled={!ready || busy}
                onClick={() => props.onStep(-1)}
              >
                <Replay fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={`1コマ戻る（${frameRate}fps換算）`}>
            <span>
              <IconButton
                size="small"
                aria-label={`${label}: 1コマ戻る`}
                disabled={!ready || busy}
                onClick={() => props.onStep(-1 / frameRate)}
              >
                <ChevronLeft />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? '一時停止' : '再生'}>
            <span>
              <IconButton
                aria-label={`${label}: ${playing ? '一時停止' : '再生'}`}
                disabled={!ready || busy}
                onClick={props.onToggle}
              >
                {playing ? <Pause /> : <PlayArrow />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={`1コマ進む（${frameRate}fps換算）`}>
            <span>
              <IconButton
                size="small"
                aria-label={`${label}: 1コマ進む`}
                disabled={!ready || busy}
                onClick={() => props.onStep(1 / frameRate)}
              >
                <ChevronRight />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="1秒進む">
            <span>
              <IconButton
                size="small"
                aria-label={`${label}: 1秒進む`}
                disabled={!ready || busy}
                onClick={() => props.onStep(1)}
              >
                <Forward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{
              ml: 'auto !important',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatSyncTime(time)} / {formatSyncTime(duration)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
