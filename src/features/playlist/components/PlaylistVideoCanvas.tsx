import React from 'react';
import { Box } from '@mui/material';
import type { AnnotationTarget, ItemAnnotation } from '../../../types/Playlist';
import AnnotationCanvas, { AnnotationCanvasRef } from './AnnotationCanvas';
import { PlaylistDrawingTargetToggle } from './PlaylistDrawingTargetToggle';

type ContentRect = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

type CanvasSize = { width: number; height: number };

type PlaylistVideoCanvasProps = {
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  viewMode: 'dual' | 'angle1' | 'angle2';
  isDrawingMode: boolean;
  drawingTarget: AnnotationTarget;
  onDrawingTargetChange: (value: AnnotationTarget) => void;
  annotationCanvasRefPrimary: React.RefObject<AnnotationCanvasRef>;
  annotationCanvasRefSecondary: React.RefObject<AnnotationCanvasRef>;
  primaryCanvasSize: CanvasSize;
  secondaryCanvasSize: CanvasSize;
  primaryContentRect: ContentRect;
  secondaryContentRect: ContentRect;
  currentAnnotation?: ItemAnnotation;
  defaultFreezeDuration: number;
  onObjectsChange: (objects: ItemAnnotation['objects'], target: AnnotationTarget) => void;
  onFreezeDurationChange: (duration: number) => void;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoRef2: React.RefObject<HTMLVideoElement>;
};

export const PlaylistVideoCanvas = ({
  currentVideoSource,
  currentVideoSource2,
  viewMode,
  isDrawingMode,
  drawingTarget,
  onDrawingTargetChange,
  annotationCanvasRefPrimary,
  annotationCanvasRefSecondary,
  primaryCanvasSize,
  secondaryCanvasSize,
  primaryContentRect,
  secondaryContentRect,
  currentAnnotation,
  defaultFreezeDuration,
  onObjectsChange,
  onFreezeDurationChange,
  currentTime,
  videoRef,
  videoRef2,
}: PlaylistVideoCanvasProps) => {
  const isDualView = viewMode === 'dual';

  return (
    <>
      {isDrawingMode && isDualView && currentVideoSource2 && (
        <PlaylistDrawingTargetToggle
          drawingTarget={drawingTarget}
          hasSecondary={Boolean(currentVideoSource2)}
          onChange={onDrawingTargetChange}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: isDualView && currentVideoSource2 ? '50%' : '100%',
          height: '100%',
          zIndex: viewMode === 'angle2' ? -1 : 0,
          pointerEvents: viewMode === 'angle2' ? 'none' : 'auto',
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: viewMode === 'angle2' ? 0 : 1,
          }}
        />
        <AnnotationCanvas
          ref={annotationCanvasRefPrimary}
          width={primaryCanvasSize.width}
          height={primaryCanvasSize.height}
          isActive={isDrawingMode && drawingTarget === 'primary'}
          target="primary"
          initialObjects={currentAnnotation?.objects}
          freezeDuration={currentAnnotation?.freezeDuration ?? defaultFreezeDuration}
          contentRect={primaryContentRect}
          onObjectsChange={(objects) => onObjectsChange(objects, 'primary')}
          onFreezeDurationChange={onFreezeDurationChange}
          currentTime={currentTime}
        />
      </Box>
      {currentVideoSource2 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: isDualView ? '50%' : 0,
            width: isDualView ? '50%' : '100%',
            height: '100%',
            borderLeft: isDualView
              ? '1px solid rgba(255,255,255,0.2)'
              : 'none',
            zIndex: viewMode === 'angle1' ? -1 : 0,
            pointerEvents: viewMode === 'angle1' ? 'none' : 'auto',
          }}
        >
          <video
            ref={videoRef2}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: viewMode === 'angle1' ? 0 : 1,
            }}
          />
          <AnnotationCanvas
            ref={annotationCanvasRefSecondary}
            width={secondaryCanvasSize.width}
            height={secondaryCanvasSize.height}
            isActive={isDrawingMode && drawingTarget === 'secondary'}
            target="secondary"
            initialObjects={currentAnnotation?.objects}
            freezeDuration={currentAnnotation?.freezeDuration ?? defaultFreezeDuration}
            contentRect={secondaryContentRect}
            onObjectsChange={(objects) => onObjectsChange(objects, 'secondary')}
            onFreezeDurationChange={onFreezeDurationChange}
            currentTime={currentTime}
          />
        </Box>
      )}
    </>
  );
};
