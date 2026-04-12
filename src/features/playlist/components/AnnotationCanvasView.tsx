import React from 'react';
import { Box } from '@mui/material';
import type { DrawingToolType } from '../../../types/playlist/core';
import { AnnotationTextInputOverlay } from './AnnotationTextInputOverlay';
import { AnnotationToolbar } from './AnnotationToolbar';

interface AnnotationCanvasViewProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  isActive: boolean;
  tool: DrawingToolType;
  draggingObjectId: string | null;
  onStart: (event: React.MouseEvent | React.TouchEvent) => void;
  onMove: (event: React.MouseEvent | React.TouchEvent) => void;
  onDragExisting: (event: React.MouseEvent | React.TouchEvent) => void;
  onEnd: () => void;
  textPosition: { x: number; y: number } | null;
  textInput: string;
  color: string;
  onTextInputChange: (value: string) => void;
  onTextSubmit: () => void;
  onTextCancel: () => void;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  toolbarPosition: { x: number; y: number };
  isDraggingToolbar: boolean;
  onToolbarDragStart: (event: React.MouseEvent) => void;
  onToolChange: (tool: DrawingToolType) => void;
  colors: string[];
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (value: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
  freezeDuration: number;
  minFreezeDuration: number;
  onFreezeDurationChange: (value: number) => void;
}

export const AnnotationCanvasView = ({
  containerRef,
  canvasRef,
  width,
  height,
  isActive,
  tool,
  draggingObjectId,
  onStart,
  onMove,
  onDragExisting,
  onEnd,
  textPosition,
  textInput,
  color,
  onTextInputChange,
  onTextSubmit,
  onTextCancel,
  toolbarRef,
  toolbarPosition,
  isDraggingToolbar,
  onToolbarDragStart,
  onToolChange,
  colors,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  onUndo,
  onClear,
  freezeDuration,
  minFreezeDuration,
  onFreezeDurationChange,
}: AnnotationCanvasViewProps) => {
  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: tool === 'text' ? 'text' : 'crosshair',
          touchAction: 'none',
          pointerEvents: isActive ? 'auto' : 'none',
        }}
        onMouseDown={(event) => onStart(event)}
        onMouseMove={(event) => {
          if (tool === 'select' && draggingObjectId) {
            onDragExisting(event);
          } else {
            onMove(event);
          }
        }}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(event) => onStart(event)}
        onTouchMove={(event) => {
          if (tool === 'select' && draggingObjectId) {
            onDragExisting(event);
          } else {
            onMove(event);
          }
        }}
        onTouchEnd={onEnd}
      />

      {textPosition && (
        <AnnotationTextInputOverlay
          width={width}
          height={height}
          textPosition={textPosition}
          textInput={textInput}
          color={color}
          onChange={onTextInputChange}
          onSubmit={onTextSubmit}
          onCancel={onTextCancel}
        />
      )}

      <AnnotationToolbar
        isActive={isActive}
        toolbarRef={toolbarRef}
        position={toolbarPosition}
        isDragging={isDraggingToolbar}
        onDragStart={onToolbarDragStart}
        tool={tool}
        onToolChange={onToolChange}
        colors={colors}
        color={color}
        onColorChange={onColorChange}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={onStrokeWidthChange}
        canUndo={canUndo}
        onUndo={onUndo}
        onClear={onClear}
        freezeDuration={freezeDuration}
        minFreezeDuration={minFreezeDuration}
        onFreezeDurationChange={onFreezeDurationChange}
      />
    </Box>
  );
};
