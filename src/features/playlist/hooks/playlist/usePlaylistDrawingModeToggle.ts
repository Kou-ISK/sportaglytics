import { useCallback } from 'react';
import type { AnnotationTarget } from '../../../../types/Playlist';
import type { AnnotationCanvasRef } from '../../components/AnnotationCanvas';

interface UsePlaylistDrawingModeToggleParams {
  isDrawingMode: boolean;
  setIsDrawingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  persistCanvasObjects: (
    ref: React.RefObject<AnnotationCanvasRef | null>,
    target: AnnotationTarget,
  ) => void;
  annotationCanvasRefPrimary: React.RefObject<AnnotationCanvasRef | null>;
  annotationCanvasRefSecondary: React.RefObject<AnnotationCanvasRef | null>;
}

export const usePlaylistDrawingModeToggle = ({
  isDrawingMode,
  setIsDrawingMode,
  setIsPlaying,
  persistCanvasObjects,
  annotationCanvasRefPrimary,
  annotationCanvasRefSecondary,
}: UsePlaylistDrawingModeToggleParams) => {
  return useCallback(() => {
    if (isDrawingMode) {
      persistCanvasObjects(annotationCanvasRefPrimary, 'primary');
      persistCanvasObjects(annotationCanvasRefSecondary, 'secondary');
    }
    setIsDrawingMode(!isDrawingMode);
    if (!isDrawingMode) {
      setIsPlaying(false);
    }
  }, [
    annotationCanvasRefPrimary,
    annotationCanvasRefSecondary,
    isDrawingMode,
    persistCanvasObjects,
    setIsDrawingMode,
    setIsPlaying,
  ]);
};
