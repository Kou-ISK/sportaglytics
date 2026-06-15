import React from 'react';
import { Paper, Typography, alpha } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { DragAndDropState } from '../hooks/useDragAndDrop';

interface DropZoneCardProps {
  dragState: DragAndDropState;
}

export const DropZoneCard: React.FC<DropZoneCardProps> = ({ dragState }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 2,
        py: 1.5,
        borderStyle: 'dashed',
        borderColor: (() => {
          if (!dragState.isDragging) return 'divider';
          return dragState.isValidDrop ? 'primary.main' : 'error.main';
        })(),
        bgcolor: (theme) => {
          if (!dragState.isDragging) return 'background.paper';
          const baseColor = dragState.isValidDrop
            ? theme.palette.primary.main
            : theme.palette.error.main;
          return alpha(baseColor, 0.08);
        },
        transition: 'all 0.2s ease-in-out',
        cursor: 'pointer',
      }}
    >
      <CloudUploadIcon
        sx={{
          fontSize: 22,
          color: dragState.isDragging ? 'primary.main' : 'text.secondary',
          mr: 1,
          verticalAlign: 'middle',
        }}
      />
      <Typography component="span" variant="body2" color="text.secondary">
        {dragState.isDragging ? 'Drop package' : 'Drop .stpkg'}
      </Typography>
    </Paper>
  );
};
