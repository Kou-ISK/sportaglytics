import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import type { CodeWindowButton } from '../../../../types/settings/coreTypes';
import { CodeWindowButtonSurface } from '../../../../components/ui/composites/CodeWindowButtonSurface';

type FreeCanvasButtonProps = {
  button: CodeWindowButton;
  isSelected: boolean;
  isDragging: boolean;
  isLinkSource: boolean;
  buttonColor: string;
  onMouseDown: (event: React.MouseEvent) => void;
  onRightMouseDown: (event: React.MouseEvent) => void;
  onInspect?: () => void;
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
  onInspect,
  onDelete,
  onResizeMouseDown,
}: FreeCanvasButtonProps) => {
  const isLabelButton = button.type === 'label' && Boolean(button.labelValue);
  const primaryText = isLabelButton ? button.labelValue : button.name;
  return (
    <CodeWindowButtonSurface
      button={button}
      displayText={primaryText ?? button.name}
      buttonColor={buttonColor}
      isSelectedForEditing={isSelected}
      isDragging={isDragging}
      cursor={isLinkSource ? 'crosshair' : isDragging ? 'grabbing' : 'grab'}
      onMouseDown={(event) => {
        if (event.button === 0) {
          onMouseDown(event);
        } else if (
          event.button === 2 &&
          (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey)
        ) {
          onRightMouseDown(event);
        }
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onInspect?.();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
          return;
        }
        onInspect?.();
      }}
    >
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
          <Tooltip
            title="Control/Option/Shift + 右ドラッグでリンクを作成"
            placement="top"
          >
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
    </CodeWindowButtonSurface>
  );
};
