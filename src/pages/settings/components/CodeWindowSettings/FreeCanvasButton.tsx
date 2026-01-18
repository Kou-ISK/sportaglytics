import React from 'react';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import type { CodeWindowButton } from '../../../../types/Settings';

type FreeCanvasButtonProps = {
  button: CodeWindowButton;
  isSelected: boolean;
  isDragging: boolean;
  isLinkSource: boolean;
  buttonColor: string;
  onMouseDown: (event: React.MouseEvent) => void;
  onRightMouseDown: (event: React.MouseEvent) => void;
  onDelete: () => void;
  onResizeMouseDown: (event: React.MouseEvent) => void;
};

export const FreeCanvasButton = ({
  button,
  isSelected,
  isDragging,
  isLinkSource,
  buttonColor,
  onMouseDown,
  onRightMouseDown,
  onDelete,
  onResizeMouseDown,
}: FreeCanvasButtonProps) => {
  return (
    <Paper
      elevation={isSelected ? 4 : 1}
      onMouseDown={(event) => {
        if (event.button === 0) {
          onMouseDown(event);
        } else if (event.button === 2) {
          onRightMouseDown(event);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      sx={{
        position: 'absolute',
        left: button.x,
        top: button.y,
        width: button.width,
        height: button.height,
        backgroundColor: buttonColor,
        color: button.textColor || '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isLinkSource ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
        border: isSelected ? '2px solid #fff' : 'none',
        boxShadow: isSelected ? '0 0 0 2px #1976d2' : undefined,
        borderRadius: `${button.borderRadius ?? 4}px`,
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        opacity: isDragging ? 0.8 : 1,
        p: 0.5,
        overflow: 'hidden',
        userSelect: 'none',
        zIndex: isSelected ? 10 : 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textAlign: 'center',
          fontSize: '0.7rem',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%',
        }}
      >
        {button.name}
      </Typography>
      {button.labelValue && (
        <Typography
          variant="caption"
          sx={{ fontSize: '0.6rem', opacity: 0.8, textAlign: 'center' }}
        >
          {button.labelValue}
        </Typography>
      )}
      {isSelected && (
        <>
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              p: 0.25,
              color: 'inherit',
              opacity: 0.7,
              '&:hover': { opacity: 1 },
            }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Tooltip title="右クリックドラッグで排他リンクを作成" placement="top">
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7,
              }}
            >
              <LinkIcon sx={{ fontSize: 12 }} />
            </Box>
          </Tooltip>
          <Box
            onMouseDown={(event) => {
              event.stopPropagation();
              onResizeMouseDown(event);
            }}
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              cursor: 'se-resize',
              '&::after': {
                content: '""',
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 6,
                height: 6,
                borderRight: '2px solid rgba(255,255,255,0.5)',
                borderBottom: '2px solid rgba(255,255,255,0.5)',
              },
            }}
          />
        </>
      )}
    </Paper>
  );
};
