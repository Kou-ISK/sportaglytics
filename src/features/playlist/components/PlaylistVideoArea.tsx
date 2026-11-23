import React from 'react';
import { Box } from '@mui/material';
import type {
  AnnotationTarget,
  ItemAnnotation,
  DrawingObject,
} from '../../../types/playlist/core';
import type { AnnotationCanvasRef } from './AnnotationCanvas';
import { PlaylistSlideView } from './PlaylistSlideView';
import type { PlaylistSlide } from '../../../types/playlist/core';
import { PlaylistVideoCanvas } from './PlaylistVideoCanvas';
import { PlaylistVideoPlaceholder } from './PlaylistVideoPlaceholder';
import { PlaylistVideoControlsOverlay } from './PlaylistVideoControlsOverlay';
import { PlaylistDrawingExitButton } from './PlaylistDrawingExitButton';

type PlaylistVideoAreaProps = {
  slide?: PlaylistSlide;
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  viewMode: 'dual' | 'angle1' | 'angle2';
  isDrawingMode: boolean;
  drawingTarget: AnnotationTarget;
  onDrawingTargetChange: (value: AnnotationTarget) => void;
  annotationCanvasRefPrimary: React.RefObject<AnnotationCanvasRef | null>;
  annotationCanvasRefSecondary: React.RefObject<AnnotationCanvasRef | null>;
  primaryCanvasSize: { width: number; height: number };
  secondaryCanvasSize: { width: number; height: number };
  primaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  secondaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  currentAnnotation: ItemAnnotation | null;
  defaultFreezeDuration: number;
  onObjectsChange: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
  ) => void;
  onFreezeDurationChange: (value: number) => void;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoRef2: React.RefObject<HTMLVideoElement | null>;
  hasItems: boolean;
  controlsVisible: boolean;
  scrubOwnerKey?: string;
  sliderMin: number;
  sliderMax: number;
  marks: { value: number; label: string }[];
  isPlaying: boolean;
  isFrozen: boolean;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  onSeek: (event: Event, value: number | number[]) => void;
  onSeekCommitted: (time: number) => void;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleAutoAdvance: () => void;
  onToggleLoop: () => void;
  onToggleDrawingMode: () => void;
  onToggleMute: () => void;
  onVolumeChange: (event: Event, value: number | number[]) => void;
  onToggleFullscreen: () => void;
  onVideoAreaHoverChange: (hovered: boolean) => void;
  onVideoAreaInteraction: () => void;
  showControls: boolean;
  height?: string | number;
  studioOverlay?: React.ReactNode;
};

export const PlaylistVideoArea = ({
  slide,
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
  hasItems,
  controlsVisible,
  scrubOwnerKey,
  sliderMin,
  sliderMax,
  marks,
  isPlaying,
  isFrozen,
  autoAdvance,
  loopPlaylist,
  isMuted,
  volume,
  isFullscreen,
  onSeek,
  onSeekCommitted,
  onPrevious,
  onTogglePlay,
  onNext,
  onToggleAutoAdvance,
  onToggleLoop,
  onToggleDrawingMode,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onVideoAreaHoverChange,
  onVideoAreaInteraction,
  showControls,
  height = '100%',
  studioOverlay,
}: PlaylistVideoAreaProps) => {
  return (
    <Box
      onMouseEnter={() => onVideoAreaHoverChange(true)}
      onMouseLeave={() => onVideoAreaHoverChange(false)}
      onMouseMove={onVideoAreaInteraction}
      sx={{
        flex: '1 1 auto',
        height,
        minHeight: 0,
        bgcolor: '#000',
        position: 'relative',
      }}
    >
      {slide ? <PlaylistSlideView slide={slide} /> : currentVideoSource ? (
        <PlaylistVideoCanvas
          annotationsVisible={!studioOverlay}
          currentVideoSource2={currentVideoSource2}
          viewMode={viewMode}
          isDrawingMode={isDrawingMode}
          drawingTarget={drawingTarget}
          onDrawingTargetChange={onDrawingTargetChange}
          annotationCanvasRefPrimary={annotationCanvasRefPrimary}
          annotationCanvasRefSecondary={annotationCanvasRefSecondary}
          primaryCanvasSize={primaryCanvasSize}
          secondaryCanvasSize={secondaryCanvasSize}
          primaryContentRect={primaryContentRect}
          secondaryContentRect={secondaryContentRect}
          currentAnnotation={currentAnnotation}
          defaultFreezeDuration={defaultFreezeDuration}
          onObjectsChange={onObjectsChange}
          onFreezeDurationChange={onFreezeDurationChange}
          currentTime={currentTime}
          videoRef={videoRef}
          videoRef2={videoRef2}
        />
      ) : (
        <PlaylistVideoPlaceholder isEmpty={!hasItems} />
      )}

      {studioOverlay}

      {showControls && !isDrawingMode && !studioOverlay && (
        <PlaylistVideoControlsOverlay
          key={scrubOwnerKey}
          visible={controlsVisible}
          currentTime={currentTime}
          sliderMin={sliderMin}
          sliderMax={sliderMax}
          marks={marks}
          isPlaying={isPlaying}
          isFrozen={isFrozen}
          autoAdvance={autoAdvance}
          loopPlaylist={loopPlaylist}
          isDrawingMode={isDrawingMode}
          isMuted={isMuted}
          volume={volume}
          isFullscreen={isFullscreen}
          onSeek={onSeek}
          onSeekCommitted={onSeekCommitted}
          onPrevious={onPrevious}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onToggleAutoAdvance={onToggleAutoAdvance}
          onToggleLoop={onToggleLoop}
          onToggleDrawingMode={onToggleDrawingMode}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
          onToggleFullscreen={onToggleFullscreen}
        />
      )}

      {isDrawingMode && (
        <PlaylistDrawingExitButton onExit={onToggleDrawingMode} />
      )}
    </Box>
  );
};
