import { useCallback, useEffect } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
} from '../../../../types/Playlist';
import { generateAnnotationId } from '../../components/annotationCanvasUtils';

interface UseAnnotationActionsParams {
  isActive: boolean;
  textPosition: { x: number; y: number } | null;
  textInput: string;
  setTextPosition: React.Dispatch<
    React.SetStateAction<{ x: number; y: number } | null>
  >;
  setTextInput: React.Dispatch<React.SetStateAction<string>>;
  color: string;
  strokeWidth: number;
  objects: DrawingObject[];
  setObjects: React.Dispatch<React.SetStateAction<DrawingObject[]>>;
  setCurrentObject: React.Dispatch<React.SetStateAction<DrawingObject | null>>;
  onObjectsChange?: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
  ) => void;
  currentTime?: number;
  target: AnnotationTarget;
  selectedObjectId: string | null;
  setSelectedObjectId: React.Dispatch<React.SetStateAction<string | null>>;
  width: number;
  height: number;
  contentRect?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
}

export const useAnnotationActions = ({
  isActive,
  textPosition,
  textInput,
  setTextPosition,
  setTextInput,
  color,
  strokeWidth,
  objects,
  setObjects,
  setCurrentObject,
  onObjectsChange,
  currentTime,
  target,
  selectedObjectId,
  setSelectedObjectId,
  width,
  height,
  contentRect,
}: UseAnnotationActionsParams) => {
  const handleTextSubmit = useCallback(() => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null);
      setTextInput('');
      return;
    }

    const timestamp = typeof currentTime === 'number' ? currentTime : 0;
    const textObject: DrawingObject = {
      id: generateAnnotationId(),
      type: 'text',
      color,
      strokeWidth,
      startX: textPosition.x,
      startY: textPosition.y,
      text: textInput,
      fontSize: 24,
      timestamp,
      target,
      baseWidth: contentRect?.width ?? width,
      baseHeight: contentRect?.height ?? height,
    };

    const newObjects = [...objects, textObject];
    setObjects(newObjects);
    onObjectsChange?.(newObjects, target);

    setTextPosition(null);
    setTextInput('');
  }, [
    color,
    contentRect?.height,
    contentRect?.width,
    currentTime,
    height,
    objects,
    onObjectsChange,
    setObjects,
    setTextInput,
    setTextPosition,
    strokeWidth,
    target,
    textInput,
    textPosition,
    width,
  ]);

  const handleUndo = useCallback(() => {
    if (objects.length === 0) return;
    const newObjects = objects.slice(0, -1);
    setObjects(newObjects);
    onObjectsChange?.(newObjects, target);
  }, [objects, onObjectsChange, setObjects, target]);

  const handleClear = useCallback(() => {
    setObjects([]);
    setCurrentObject(null);
    onObjectsChange?.([], target);
    setSelectedObjectId(null);
  }, [onObjectsChange, setCurrentObject, setObjects, setSelectedObjectId, target]);

  useEffect(() => {
    if (!isActive) return;
    const handler = (event: KeyboardEvent) => {
      if (!selectedObjectId) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setObjects((prev) => {
          const filtered = prev.filter((obj) => obj.id !== selectedObjectId);
          onObjectsChange?.(filtered, target);
          return filtered;
        });
        setSelectedObjectId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, onObjectsChange, selectedObjectId, setObjects, setSelectedObjectId, target]);

  return {
    handleTextSubmit,
    handleUndo,
    handleClear,
  };
};
