import React from 'react';
import { Box } from '@mui/material';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/settings/coreTypes';
import { DEFAULT_BUTTON_COLORS } from './types';
import { FreeCanvasButton } from './FreeCanvasButton';
import { FreeCanvasEmptyState } from './FreeCanvasEmptyState';
import { FreeCanvasLinkLayer } from './FreeCanvasLinkLayer';

interface FreeCanvasStageProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  layout: CodeWindowLayout;
  dragMode: 'move' | 'resize' | 'link' | null;
  draggedButton: CodeWindowButton | null;
  linkStartButton: CodeWindowButton | null;
  selectedButtonIds: string[];
  links: React.ReactNode;
  draggingLink: React.ReactNode;
  onCanvasClick: (event: React.MouseEvent) => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseUp: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onButtonMouseDown: (
    event: React.MouseEvent,
    button: CodeWindowButton,
    mode: 'move' | 'resize' | 'link',
  ) => void;
  onButtonRightMouseDown: (
    event: React.MouseEvent,
    button: CodeWindowButton,
  ) => void;
  onDeleteButton: (buttonId: string) => void;
}

export const FreeCanvasStage = ({
  canvasRef,
  layout,
  dragMode,
  draggedButton,
  linkStartButton,
  selectedButtonIds,
  links,
  draggingLink,
  onCanvasClick,
  onMouseMove,
  onMouseUp,
  onContextMenu,
  onButtonMouseDown,
  onButtonRightMouseDown,
  onDeleteButton,
}: FreeCanvasStageProps) => {
  return (
    <Box
      ref={canvasRef}
      onClick={onCanvasClick}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
      sx={{
        position: 'relative',
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        backgroundColor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        cursor: dragMode === 'link' ? 'crosshair' : 'default',
      }}
    >
      <FreeCanvasLinkLayer
        width={layout.canvasWidth}
        height={layout.canvasHeight}
        links={links}
        draggingLink={draggingLink}
      />

      {layout.buttons.map((button) => {
        const isSelected = selectedButtonIds.includes(button.id);
        const isDragging =
          draggedButton?.id === button.id && dragMode === 'move';
        const isLinkSource = linkStartButton?.id === button.id;
        const buttonColor =
          button.color ||
          (button.type === 'action'
            ? DEFAULT_BUTTON_COLORS.action
            : DEFAULT_BUTTON_COLORS.label);

        return (
          <FreeCanvasButton
            key={button.id}
            button={button}
            isSelected={isSelected}
            isDragging={isDragging}
            isLinkSource={isLinkSource}
            buttonColor={buttonColor}
            onMouseDown={(event) => onButtonMouseDown(event, button, 'move')}
            onRightMouseDown={(event) => onButtonRightMouseDown(event, button)}
            onDelete={() => onDeleteButton(button.id)}
            onResizeMouseDown={(event) =>
              onButtonMouseDown(event, button, 'resize')
            }
          />
        );
      })}

      {layout.buttons.length === 0 && <FreeCanvasEmptyState />}
    </Box>
  );
};
