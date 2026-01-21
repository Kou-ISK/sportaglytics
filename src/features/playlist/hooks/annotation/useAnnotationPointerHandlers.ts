import { useCallback } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  DrawingToolType,
} from '../../../../types/Playlist';
import {
  findObjectAtPoint,
  generateAnnotationId,
  scaleObjectForDisplay,
  shiftObject,
} from '../../components/annotationCanvasUtils';

interface UseAnnotationPointerHandlersParams {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  tool: DrawingToolType;
  color: string;
  strokeWidth: number;
  currentTime?: number;
  target: AnnotationTarget;
  width: number;
  height: number;
  contentRect?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  objects: DrawingObject[];
  setObjects: React.Dispatch<React.SetStateAction<DrawingObject[]>>;
  currentObject: DrawingObject | null;
  setCurrentObject: React.Dispatch<React.SetStateAction<DrawingObject | null>>;
  setSelectedObjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextPosition: React.Dispatch<
    React.SetStateAction<{ x: number; y: number } | null>
  >;
  draggingObjectId: string | null;
  setDraggingObjectId: React.Dispatch<React.SetStateAction<string | null>>;
  dragObjectStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isDrawingRef: React.MutableRefObject<boolean>;
  onObjectsChange?: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
  ) => void;
}

export const useAnnotationPointerHandlers = ({
  canvasRef,
  isActive,
  tool,
  color,
  strokeWidth,
  currentTime,
  target,
  width,
  height,
  contentRect,
  objects,
  setObjects,
  currentObject,
  setCurrentObject,
  setSelectedObjectId,
  setTextPosition,
  draggingObjectId,
  setDraggingObjectId,
  dragObjectStartRef,
  isDrawingRef,
  onObjectsChange,
}: UseAnnotationPointerHandlersParams) => {
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const content = contentRect || {
        width,
        height,
        offsetX: 0,
        offsetY: 0,
      };

      let clientX: number;
      let clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      let x = canvasX - content.offsetX;
      let y = canvasY - content.offsetY;
      x = Math.max(0, Math.min(content.width, x));
      y = Math.max(0, Math.min(content.height, y));
      return { x, y };
    },
    [canvasRef, contentRect, height, width],
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isActive) return;

      const coords = getCanvasCoords(e);

      if (tool === 'select') {
        const displayTarget = contentRect || {
          width,
          height,
          offsetX: 0,
          offsetY: 0,
        };
        const displayObjects = objects.map((obj) =>
          scaleObjectForDisplay(obj, displayTarget),
        );
        const hit = findObjectAtPoint(displayObjects, coords.x, coords.y, 8);
        if (hit) {
          setSelectedObjectId(hit.id);
          setDraggingObjectId(hit.id);
          dragObjectStartRef.current = coords;
        } else {
          setSelectedObjectId(null);
          setDraggingObjectId(null);
        }
        return;
      }

      if (tool === 'text') {
        setTextPosition(coords);
        return;
      }

      isDrawingRef.current = true;

      // 現在の再生位置をタイムスタンプとして記録
      const timestamp = typeof currentTime === 'number' ? currentTime : 0;

      const newObject: DrawingObject = {
        id: generateAnnotationId(),
        type: tool,
        color,
        strokeWidth,
        startX: coords.x,
        startY: coords.y,
        path: tool === 'pen' ? [{ x: coords.x, y: coords.y }] : undefined,
        timestamp,
        target,
        baseWidth: contentRect?.width ?? width,
        baseHeight: contentRect?.height ?? height,
      };

      setCurrentObject(newObject);
    },
    [
      color,
      contentRect,
      currentTime,
      dragObjectStartRef,
      getCanvasCoords,
      height,
      isActive,
      isDrawingRef,
      objects,
      setCurrentObject,
      setDraggingObjectId,
      setSelectedObjectId,
      setTextPosition,
      strokeWidth,
      target,
      tool,
      width,
    ],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || !currentObject || !isActive) return;

      const coords = getCanvasCoords(e);

      if (tool === 'pen') {
        setCurrentObject((prev) => {
          if (!prev || !prev.path) return prev;
          return {
            ...prev,
            path: [...prev.path, { x: coords.x, y: coords.y }],
          };
        });
      } else {
        setCurrentObject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            endX: coords.x,
            endY: coords.y,
          };
        });
      }
    },
    [currentObject, getCanvasCoords, isActive, isDrawingRef, tool],
  );

  const handleEnd = useCallback(() => {
    if (tool === 'select' && draggingObjectId) {
      setDraggingObjectId(null);
      dragObjectStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current || !currentObject) return;

    isDrawingRef.current = false;

    // Only add if the object has meaningful content
    const isValid =
      tool === 'pen'
        ? currentObject.path && currentObject.path.length > 1
        : currentObject.endX !== undefined &&
          currentObject.endY !== undefined &&
          (Math.abs(currentObject.endX - currentObject.startX) > 5 ||
            Math.abs(currentObject.endY - currentObject.startY) > 5);

    if (isValid) {
      const newObjects = [...objects, currentObject];
      setObjects(newObjects);
      onObjectsChange?.(newObjects, target);
    }

    setCurrentObject(null);
  }, [
    currentObject,
    draggingObjectId,
    isDrawingRef,
    objects,
    onObjectsChange,
    setCurrentObject,
    setDraggingObjectId,
    setObjects,
    target,
    tool,
  ]);

  const handleDragExisting = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isActive || tool !== 'select' || !draggingObjectId) return;
      const start = dragObjectStartRef.current;
      if (!start) return;
      const coords = getCanvasCoords(e);
      const dx = coords.x - start.x;
      const dy = coords.y - start.y;
      dragObjectStartRef.current = coords;

      const selected = objects.find((obj) => obj.id === draggingObjectId);
      const scaleX =
        selected && selected.baseWidth
          ? (contentRect?.width ?? width) / selected.baseWidth
          : 1;
      const scaleY =
        selected && selected.baseHeight
          ? (contentRect?.height ?? height) / selected.baseHeight
          : 1;
      const baseDx = dx / scaleX;
      const baseDy = dy / scaleY;

      setObjects((prev) => {
        const updated = prev.map((obj) =>
          obj.id === draggingObjectId
            ? shiftObject(obj, baseDx, baseDy)
            : obj,
        );
        onObjectsChange?.(updated, target);
        return updated;
      });
    },
    [
      contentRect,
      draggingObjectId,
      getCanvasCoords,
      height,
      isActive,
      objects,
      onObjectsChange,
      setObjects,
      target,
      tool,
      width,
    ],
  );

  return {
    handleStart,
    handleMove,
    handleEnd,
    handleDragExisting,
  };
};
