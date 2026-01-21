import React from 'react';
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Brush,
  Fullscreen,
  FullscreenExit,
  Loop,
  Pause,
  PlayArrow,
  PlaylistPlay,
  SkipNext,
  SkipPrevious,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material';
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
  onSeekCommitted: () => void;
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

export const PlaylistVideoControlsOverlay = ({
  visible,
  currentTime,
  sliderMin,
  sliderMax,
  marks,
  isPlaying,
  isFrozen,
  autoAdvance,
  loopPlaylist,
  isDrawingMode,
  isMuted,
  volume,
  isFullscreen,
  onSeek,
  onSeekCommitted,
  onPrevious,
  onTogglePlay,
  onNext,
  onToggleAutoAdvance,
  onToggleLoop,
  onToggleDrawingMode,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
}: PlaylistVideoControlsOverlayProps) => {
  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        p: 1,
        bgcolor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
      }}
    >
      <Slider
        size="small"
        value={currentTime}
        min={sliderMin}
        max={sliderMax}
        onChange={onSeek}
        onChangeCommitted={onSeekCommitted}
        sx={{
          mb: 0.5,
          height: 4,
          '& .MuiSlider-thumb': { width: 10, height: 10 },
          '& .MuiSlider-track': { bgcolor: 'primary.main' },
        }}
        marks={marks}
      />
      <Stack direction="row" spacing={0.4} alignItems="center">
        <IconButton size="small" onClick={onPrevious}>
          <SkipPrevious sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" onClick={onTogglePlay} color="primary">
          {isPlaying && !isFrozen ? (
            <Pause sx={{ fontSize: 20 }} />
          ) : (
            <PlayArrow sx={{ fontSize: 20 }} />
          )}
        </IconButton>
        <IconButton size="small" onClick={onNext}>
          <SkipNext sx={{ fontSize: 18 }} />
        </IconButton>

        <Divider
          orientation="vertical"
          flexItem
          sx={{ mx: 0.5, bgcolor: 'grey.700' }}
        />

        <Tooltip
          title={
            autoAdvance
              ? PLAYLIST_CONTROL_LABELS.autoAdvance.on
              : PLAYLIST_CONTROL_LABELS.autoAdvance.off
          }
        >
          <IconButton
            size="small"
            onClick={onToggleAutoAdvance}
            color={autoAdvance ? 'primary' : 'default'}
          >
            <PlaylistPlay sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={
            loopPlaylist
              ? PLAYLIST_CONTROL_LABELS.loop.on
              : PLAYLIST_CONTROL_LABELS.loop.off
          }
        >
          <IconButton
            size="small"
            onClick={onToggleLoop}
            color={loopPlaylist ? 'primary' : 'default'}
          >
            <Loop sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Divider
          orientation="vertical"
          flexItem
          sx={{ mx: 0.5, bgcolor: 'grey.700' }}
        />

        <Tooltip
          title={
            isDrawingMode
              ? PLAYLIST_CONTROL_LABELS.drawing.on
              : PLAYLIST_CONTROL_LABELS.drawing.off
          }
        >
          <IconButton
            size="small"
            onClick={onToggleDrawingMode}
            color={isDrawingMode ? 'warning' : 'default'}
          >
            <Brush sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <IconButton size="small" onClick={onToggleMute}>
          {isMuted ? (
            <VolumeOff sx={{ fontSize: 18 }} />
          ) : (
            <VolumeUp sx={{ fontSize: 18 }} />
          )}
        </IconButton>
        <Slider
          size="small"
          value={volume}
          min={0}
          max={1}
          step={0.1}
          onChange={onVolumeChange}
          sx={{ width: 50, height: 3 }}
        />
        <IconButton size="small" onClick={onToggleFullscreen}>
          {isFullscreen ? (
            <FullscreenExit sx={{ fontSize: 18 }} />
          ) : (
            <Fullscreen fontSize="small" />
          )}
        </IconButton>
      </Stack>
    </Paper>
  );
};
