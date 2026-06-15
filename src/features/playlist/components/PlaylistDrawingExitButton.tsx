import React from 'react';
import { Button, Paper } from '@mui/material';
import { Brush } from '@mui/icons-material';

type PlaylistDrawingExitButtonProps = {
  onExit: () => void;
};

export const PlaylistDrawingExitButton = ({
  onExit,
}: PlaylistDrawingExitButtonProps) => {
  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        p: 1,
        bgcolor: 'rgba(0,0,0,0.9)',
      }}
    >
      <Button
        variant="contained"
        color="warning"
        size="small"
        onClick={onExit}
        startIcon={<Brush />}
      >
        描画を終了
      </Button>
    </Paper>
  );
};
