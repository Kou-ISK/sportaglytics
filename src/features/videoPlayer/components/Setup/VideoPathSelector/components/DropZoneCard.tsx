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
      elevation={dragState.isDragging ? 8 : 2}
      sx={{
        p: 4,
        textAlign: 'center',
        border: '2px dashed',
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
          fontSize: 64,
          color: dragState.isDragging ? 'primary.main' : 'text.secondary',
          mb: 2,
        }}
      />
      <Typography variant="h6" gutterBottom>
        {dragState.isDragging ? 'ここにドロップ' : 'パッケージフォルダをドラッグ&ドロップ'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        または下のボタンから選択
      </Typography>
    </Paper>
  );
};
