import React from 'react';
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { AnnotationTarget } from '../../../types/Playlist';

type PlaylistDrawingTargetToggleProps = {
  drawingTarget: AnnotationTarget;
  hasSecondary: boolean;
  onChange: (value: AnnotationTarget) => void;
};

export const PlaylistDrawingTargetToggle = ({
  drawingTarget,
  hasSecondary,
  onChange,
}: PlaylistDrawingTargetToggleProps) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 6,
      }}
    >
      <Paper
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        }}
        elevation={3}
      >
        <Typography variant="caption" sx={{ color: 'grey.200' }}>
          描画対象
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={drawingTarget}
          onChange={(_, value) => value && onChange(value as AnnotationTarget)}
        >
          <ToggleButton value="primary">メイン</ToggleButton>
          <ToggleButton value="secondary" disabled={!hasSecondary}>
            サブ
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
    </Box>
  );
};
