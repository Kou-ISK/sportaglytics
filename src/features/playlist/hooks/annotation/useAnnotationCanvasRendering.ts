import {
  annotationAtTime,
  isAnnotationVisible,
} from '../../../../shared/tactics/annotationMotion';
import { useCallback, useRef, useState } from 'react';
import { useVideoFrameDrawing } from './useVideoFrameDrawing';
import { applyAnnotationChroma } from './applyAnnotationChroma';
import type { ChromaKey } from '../../../../shared/tactics/chromaKey';
import type { DrawingObject } from '../../../../types/playlist/core';
import {
  getObjectBounds,
  renderObject,
  scaleObjectForDisplay,
} from '../../components/annotationCanvasUtils';

interface UseAnnotationCanvasRenderingParams {
  chromaKey?: ChromaKey;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
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
  chromaKey,
  videoRef,
  canvasRef,
  objects,
  currentObject,
  currentTime,
  contentRect,
  width,
  height,
  selectedObjectId,
  timestampTolerance,
}: UseAnnotationCanvasRenderingParams): string => {
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState('');
  const lastError = useRef('');
  const reportError = useCallback((message: string): void => {
    if (lastError.current === message) return;
    lastError.current = message;
    setRenderError(message);
  }, []);
  const renderAllObjects = useCallback(
    (frameTime = currentTime): void => {
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
        typeof frameTime === 'number'
          ? objects.filter((object) =>
              isAnnotationVisible(object, frameTime, timestampTolerance),
            )
          : objects;

      const displayObjects = filteredObjects.map((object) =>
        scaleObjectForDisplay(
          frameTime === undefined
            ? object
            : annotationAtTime(object, frameTime),
          displayTarget,
        ),
      );
      const displayCurrent = currentObject
        ? scaleObjectForDisplay(currentObject, displayTarget)
        : null;

      displayObjects.forEach((object) => renderObject(ctx, object));
      if (displayCurrent) {
        renderObject(ctx, displayCurrent);
      }

      if (chromaKey && videoRef?.current) {
        try {
          scratch.current ??= document.createElement('canvas');
          applyAnnotationChroma(
            ctx,
            videoRef.current,
            chromaKey,
            displayTarget,
            scratch.current,
          );
          reportError('');
        } catch {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          reportError(
            '映像の色を読み込めないため、芝色処理を適用できません。平面パネルで解除してください。',
          );
        }
      } else reportError('');
      if (!selectedObjectId) return;
      const selectedObject = displayObjects.find(
        (object) => object.id === selectedObjectId,
      );
      if (!selectedObject) return;

      ctx.save();
      ctx.strokeStyle = '#64A9FF';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      const bounds = getObjectBounds(selectedObject);
      if (bounds) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(bounds.maxX - 4, bounds.maxY - 4, 8, 8);
        ctx.strokeRect(
          bounds.minX - 4,
          bounds.minY - 4,
          bounds.maxX - bounds.minX + 8,
          bounds.maxY - bounds.minY + 8,
        );
      }
      if (
        selectedObject.type === 'linkedDiscs' ||
        (selectedObject.type === 'polygon' &&
          (selectedObject.path?.length ?? 0) <= 12)
      ) {
        ctx.setLineDash([]);
        selectedObject.path?.forEach((node) => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
      ctx.restore();
    },
    [
      reportError,
      chromaKey,
      videoRef,
      canvasRef,
      objects,
      currentObject,
      currentTime,
      timestampTolerance,
      contentRect,
      width,
      height,
      selectedObjectId,
    ],
  );

  useVideoFrameDrawing(
    videoRef,
    Boolean(chromaKey || objects.some((object) => object.motion)),
    renderAllObjects,
  );
  return renderError;
};
