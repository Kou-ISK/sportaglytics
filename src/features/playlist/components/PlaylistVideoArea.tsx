import React from 'react';
import { Box } from '@mui/material';
import type {
  AnnotationTarget,
  ItemAnnotation,
  DrawingObject,
} from '../../../types/Playlist';
import type { AnnotationCanvasRef } from './AnnotationCanvas';
import { PlaylistVideoCanvas } from './PlaylistVideoCanvas';
import { PlaylistVideoPlaceholder } from './PlaylistVideoPlaceholder';
import { PlaylistVideoControlsOverlay } from './PlaylistVideoControlsOverlay';
import { PlaylistDrawingExitButton } from './PlaylistDrawingExitButton';

type PlaylistVideoAreaProps = {
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  viewMode: 'dual' | 'angle1' | 'angle2';
  isDrawingMode: boolean;
  drawingTarget: AnnotationTarget;
  onDrawingTargetChange: (value: AnnotationTarget) => void;
  annotationCanvasRefPrimary: React.RefObject<AnnotationCanvasRef>;
  annotationCanvasRefSecondary: React.RefObject<AnnotationCanvasRef>;
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
  currentAnnotation: ItemAnnotation | undefined;
  defaultFreezeDuration: number;
  onObjectsChange: (
    target: AnnotationTarget,
    objects: DrawingObject[],
  ) => void;
  onFreezeDurationChange: (value: number) => void;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoRef2: React.RefObject<HTMLVideoElement>;
  hasItems: boolean;
  controlsVisible: boolean;
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
  onSeek: (time: number) => void;
  onSeekCommitted: () => void;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleAutoAdvance: () => void;
  onToggleLoop: () => void;
  onToggleDrawingMode: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onToggleFullscreen: () => void;
  onControlsVisibleChange: (visible: boolean) => void;
  showControls: boolean;
};

export const PlaylistVideoArea = ({
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
  onControlsVisibleChange,
  showControls,
}: PlaylistVideoAreaProps) => {
  return (
    <Box
      onMouseEnter={() => onControlsVisibleChange(true)}
      onMouseLeave={() => onControlsVisibleChange(false)}
      onMouseMove={() => onControlsVisibleChange(true)}
      sx={{
        flex: '0 0 auto',
        height: '50%',
        minHeight: 250,
        bgcolor: '#000',
        position: 'relative',
      }}
    >
      {currentVideoSource ? (
        <PlaylistVideoCanvas
          currentVideoSource={currentVideoSource}
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

      {showControls && !isDrawingMode && (
        <PlaylistVideoControlsOverlay
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
