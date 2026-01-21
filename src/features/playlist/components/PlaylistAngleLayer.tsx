import React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { AnnotationTarget, ItemAnnotation } from '../../../types/Playlist';
import AnnotationCanvas, { AnnotationCanvasRef } from './AnnotationCanvas';

type ContentRect = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

type CanvasSize = { width: number; height: number };

type PlaylistAngleLayerProps = {
  boxSx: SxProps<Theme>;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoStyle: React.CSSProperties;
  annotationCanvasRef: React.RefObject<AnnotationCanvasRef>;
  canvasSize: CanvasSize;
  contentRect: ContentRect;
  isDrawingMode: boolean;
  drawingTarget: AnnotationTarget;
  target: AnnotationTarget;
  initialObjects?: ItemAnnotation['objects'];
  freezeDuration: number;
  onObjectsChange: (objects: ItemAnnotation['objects'], target: AnnotationTarget) => void;
  onFreezeDurationChange: (duration: number) => void;
  currentTime: number;
};

export const PlaylistAngleLayer = ({
  boxSx,
  videoRef,
  videoStyle,
  annotationCanvasRef,
  canvasSize,
  contentRect,
  isDrawingMode,
  drawingTarget,
  target,
  initialObjects,
  freezeDuration,
  onObjectsChange,
  onFreezeDurationChange,
  currentTime,
}: PlaylistAngleLayerProps) => {
  return (
    <Box sx={boxSx}>
      <video ref={videoRef} style={videoStyle} />
      <AnnotationCanvas
        ref={annotationCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        isActive={isDrawingMode && drawingTarget === target}
        target={target}
        initialObjects={initialObjects}
        freezeDuration={freezeDuration}
        contentRect={contentRect}
        onObjectsChange={(objects) => onObjectsChange(objects, target)}
        onFreezeDurationChange={onFreezeDurationChange}
        currentTime={currentTime}
      />
    </Box>
  );
};
