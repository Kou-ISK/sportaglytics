import { PlaylistScrubSlider } from './PlaylistScrubSlider';
import { mediaChromeSx } from '../../../design-system/mediaChrome';
import type { ReactElement } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Brush,
  Fullscreen,
  FullscreenExit,
  Loop,
  PlaylistPlay,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material';
import { MovieTransportView } from '../../../components/ui';
import { PLAYLIST_CONTROL_LABELS } from '../constants/playlistControls';

type SliderMark = { value: number; label: string };

type PlaylistVideoControlsOverlayProps = {
  visible: boolean;
  currentTime: number;
  sliderMin: number;
  sliderMax: number;
  marks: SliderMark[];
  isPlaying: boolean;
  isFrozen: boolean;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  isDrawingMode: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  onSeek: (event: Event, value: number | number[]) => void;
  onSeekCommitted: (time: number) => void;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleAutoAdvance: () => void;
  onToggleLoop: () => void;
  onToggleDrawingMode: () => void;
  onToggleMute: () => void;
  onVolumeChange: (event: Event, value: number | number[]) => void;
  onToggleFullscreen: () => void;
};

export const PlaylistVideoControlsOverlay = (
  props: PlaylistVideoControlsOverlayProps,
): ReactElement => {
  const action = (
    label: string,
    icon: ReactElement,
    onClick: () => void,
    active = false,
  ): ReactElement => (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        aria-pressed={active}
        size="small"
        onClick={onClick}
        color={active ? 'primary' : 'default'}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
  const seek = (time: number): void => {
    props.onSeek(
      new Event('playlist-jog'),
      Math.min(props.sliderMax, Math.max(props.sliderMin, time)),
    );
    props.onSeekCommitted(
      Math.min(props.sliderMax, Math.max(props.sliderMin, time)),
    );
  };
  return (
    <Paper
      elevation={0}
      sx={[
        mediaChromeSx,
        {
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          boxSizing: 'border-box',
          px: 1.5,
          pb: 0.5,
          borderRadius: 2,
          opacity: props.visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: props.visible ? 'auto' : 'none',
          zIndex: (theme) => theme.custom.zIndex.stickyChrome,
          '&:focus-within': { opacity: 1, pointerEvents: 'auto' },
        },
      ]}
    >
      <Box
        sx={{ position: 'relative', height: 24, mt: 0.5 }}
        aria-label="描画のある位置"
      >
        {[...new Set(props.marks.map((mark) => mark.value))]
          .filter((time) => time >= props.sliderMin && time <= props.sliderMax)
          .map((time) => (
            <Tooltip key={time} title={`${time.toFixed(2)}秒 · 描画へ移動`}>
              <IconButton
                aria-label={`${time.toFixed(2)}秒の描画へ移動`}
                onClick={() => seek(time)}
                sx={{
                  position: 'absolute',
                  left: `${((time - props.sliderMin) / Math.max(0.001, props.sliderMax - props.sliderMin)) * 100}%`,
                  transform: 'translateX(-50%)',
                  p: 0,
                  width: 24,
                  height: 24,
                  minWidth: 24,
                  minHeight: 24,
                  color: (theme) => theme.custom.tokens.media.accent,
                }}
              >
                <Brush sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          ))}
      </Box>
      <PlaylistScrubSlider
        aria-label="映像の再生位置"
        time={props.currentTime}
        min={props.sliderMin}
        max={Math.max(props.sliderMin + 0.001, props.sliderMax)}
        onPreview={props.onSeek}
        onCommit={props.onSeekCommitted}
        marks={props.marks.map((mark) => ({ value: mark.value }))}
        sx={{ height: 2, py: 1, '& .MuiSlider-thumb': { width: 8, height: 8 } }}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" alignItems="center" sx={{ flex: 1 }}>
          <Typography
            variant="technical"
            color="text.secondary"
            sx={{ ml: 0.5, whiteSpace: 'nowrap', fontSize: 10 }}
          >
            <Box component="span" sx={{ display: 'block', opacity: 0.75 }}>
              再生位置 / 終了
            </Box>
            {props.currentTime.toFixed(2)} / {props.sliderMax.toFixed(2)}
          </Typography>
        </Stack>
        <MovieTransportView
          playing={props.isPlaying && !props.isFrozen}
          onTogglePlay={props.onTogglePlay}
          backwardLabel="1秒戻る"
          forwardLabel="1秒進む"
          onBackward={() => seek(props.currentTime - 1)}
          onForward={() => seek(props.currentTime + 1)}
          outerBackward={{ label: '前のクリップ', onClick: props.onPrevious }}
          outerForward={{ label: '次のクリップ', onClick: props.onNext }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          sx={{ flex: 1 }}
        >
          {action(
            props.loopPlaylist
              ? PLAYLIST_CONTROL_LABELS.loop.on
              : PLAYLIST_CONTROL_LABELS.loop.off,
            <Loop fontSize="small" />,
            props.onToggleLoop,
            props.loopPlaylist,
          )}
          {action(
            props.autoAdvance
              ? PLAYLIST_CONTROL_LABELS.autoAdvance.on
              : PLAYLIST_CONTROL_LABELS.autoAdvance.off,
            <PlaylistPlay fontSize="small" />,
            props.onToggleAutoAdvance,
            props.autoAdvance,
          )}
          {action(
            props.isMuted ? 'ミュート解除' : 'ミュート',
            props.isMuted ? (
              <VolumeOff fontSize="small" />
            ) : (
              <VolumeUp fontSize="small" />
            ),
            props.onToggleMute,
            props.isMuted,
          )}
          <Slider
            aria-label="音量"
            size="small"
            value={props.volume}
            min={0}
            max={1}
            step={0.05}
            onChange={props.onVolumeChange}
            sx={{ width: 44, mx: 1 }}
          />
          {action(
            props.isDrawingMode
              ? PLAYLIST_CONTROL_LABELS.drawing.on
              : PLAYLIST_CONTROL_LABELS.drawing.off,
            <Brush fontSize="small" />,
            props.onToggleDrawingMode,
            props.isDrawingMode,
          )}
          {action(
            props.isFullscreen ? '全画面を終了' : '全画面',
            props.isFullscreen ? (
              <FullscreenExit fontSize="small" />
            ) : (
              <Fullscreen fontSize="small" />
            ),
            props.onToggleFullscreen,
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
