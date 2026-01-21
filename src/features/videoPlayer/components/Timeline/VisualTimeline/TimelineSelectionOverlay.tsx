import React from 'react';
import { Box } from '@mui/material';

type TimelineSelectionOverlayProps = {
  selectionBox: { top: number; left: number; width: number; height: number };
};

export const TimelineSelectionOverlay = ({
  selectionBox,
}: TimelineSelectionOverlayProps) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: selectionBox.top,
        left: selectionBox.left,
        width: selectionBox.width,
        height: selectionBox.height,
        border: '1px dashed',
        borderColor: 'primary.main',
        bgcolor: 'primary.main',
        opacity: 0.1,
        pointerEvents: 'none',
      }}
    />
  );
};
