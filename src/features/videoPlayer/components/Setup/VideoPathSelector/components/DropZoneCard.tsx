import React from 'react';
import { Paper, Typography, alpha } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import type { DragAndDropState } from '../hooks/useDragAndDrop';

interface DropZoneCardProps {
  dragState: DragAndDropState;
}

export const DropZoneCard: React.FC<DropZoneCardProps> = ({ dragState }) => {
  return (
    <Paper
      role="status"
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1.5,
        borderStyle: 'dashed',
        borderRadius: 1,
        borderColor: (() => {
          if (!dragState.isDragging) return 'divider';
          return dragState.isValidDrop ? 'primary.main' : 'error.main';
        })(),
        bgcolor: (theme) => {
          if (!dragState.isDragging) return 'transparent';
          const baseColor = dragState.isValidDrop
            ? theme.palette.primary.main
            : theme.palette.error.main;
          return alpha(baseColor, 0.08);
        },
        transition:
          'border-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
      }}
    >
      <FileDownloadOutlinedIcon
        sx={{
          fontSize: 22,
          color: dragState.isDragging
            ? dragState.isValidDrop
              ? 'primary.main'
              : 'error.main'
            : 'text.secondary',
          mr: 1,
          verticalAlign: 'middle',
        }}
      />
      <Typography component="span" variant="body2" color="text.secondary">
        {dragState.isDragging
          ? dragState.isValidDrop
            ? 'ここにパッケージをドロップ'
            : '.stpkg パッケージをドロップしてください'
          : '.stpkg をここにドロップして開く'}
      </Typography>
    </Paper>
  );
};
