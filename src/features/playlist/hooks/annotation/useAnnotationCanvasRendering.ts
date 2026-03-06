import { useCallback, useEffect } from 'react';
import type { DrawingObject } from '../../../../types/Playlist';
import {
  getObjectBounds,
  renderObject,
  scaleObjectForDisplay,
} from '../../components/annotationCanvasUtils';

interface UseAnnotationCanvasRenderingParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  objects: DrawingObject[];
  currentObject: DrawingObject | null;
  currentTime?: number;
  contentRect?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  width: number;
  height: number;
  selectedObjectId: string | null;
  timestampTolerance: number;
}

export const useAnnotationCanvasRendering = ({
  canvasRef,
  objects,
  currentObject,
  currentTime,
  contentRect,
  width,
  height,
  selectedObjectId,
  timestampTolerance,
}: UseAnnotationCanvasRenderingParams) => {
  const renderAllObjects = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const displayTarget = contentRect || {
      width,
      height,
      offsetX: 0,
      offsetY: 0,
    };

    const filteredObjects =
      typeof currentTime === 'number'
        ? objects.filter(
            (object) =>
              Math.abs(object.timestamp - currentTime) <= timestampTolerance,
          )
        : objects;

    const displayObjects = filteredObjects.map((object) =>
      scaleObjectForDisplay(object, displayTarget),
    );
    const displayCurrent = currentObject
      ? scaleObjectForDisplay(currentObject, displayTarget)
      : null;

    displayObjects.forEach((object) => renderObject(ctx, object));
    if (displayCurrent) {
      renderObject(ctx, displayCurrent);
    }

    if (!selectedObjectId) return;
    const selectedObject = displayObjects.find(
      (object) => object.id === selectedObjectId,
    );
    if (!selectedObject) return;

    ctx.save();
    ctx.strokeStyle = '#00bcd4';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    const bounds = getObjectBounds(selectedObject);
    if (bounds) {
      ctx.strokeRect(
        bounds.minX - 4,
        bounds.minY - 4,
        bounds.maxX - bounds.minX + 8,
        bounds.maxY - bounds.minY + 8,
      );
    }
    ctx.restore();
  }, [
    canvasRef,
    objects,
    currentObject,
    currentTime,
    timestampTolerance,
    contentRect,
    width,
    height,
    selectedObjectId,
  ]);

  useEffect(() => {
    renderAllObjects();
  }, [renderAllObjects]);
};
