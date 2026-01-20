/**
 * アノテーション描画キャンバス
 * Sportscode風：図形（矩形、円、矢印、線）、フリーハンド、テキスト対応
 */
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { Box } from '@mui/material';
import type {
  AnnotationTarget,
  DrawingObject,
} from '../../../types/Playlist';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationTextInputOverlay } from './AnnotationTextInputOverlay';
import {
  getObjectBounds,
  renderObject,
  scaleObjectForDisplay,
} from './annotationCanvasUtils';
import { useDraggableToolbar } from '../hooks/useDraggableToolbar';
import { useAnnotationPointerHandlers } from '../hooks/useAnnotationPointerHandlers';
import { useAnnotationActions } from '../hooks/useAnnotationActions';
import { useAnnotationToolbarState } from '../hooks/useAnnotationToolbarState';

const TIMESTAMP_TOLERANCE = 0.12;
const MIN_FREEZE_UI_SECONDS = 1;
const DEFAULT_TOOLBAR_X = 6;
const DEFAULT_TOOLBAR_Y = 60;
const HIT_TOLERANCE = 8;

// ===== Types =====
export interface AnnotationCanvasRef {
  clearCanvas: () => void;
  getObjects: () => DrawingObject[];
  setObjects: (objects: DrawingObject[]) => void;
  exportToDataUrl: () => string | null;
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  isActive: boolean;
  target?: AnnotationTarget;
  contentRect?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  initialObjects?: DrawingObject[];
  freezeDuration?: number;
  onObjectsChange?: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
  ) => void;
  onFreezeDurationChange?: (duration: number) => void;
  currentTime?: number; // 現在の再生位置（絶対秒 or アイテム内相対秒）
}

// ===== Main Component =====
const AnnotationCanvas = forwardRef<AnnotationCanvasRef, AnnotationCanvasProps>(
  (props, ref) => {
    const {
      width,
      height,
      isActive,
      target = 'primary',
      contentRect,
      initialObjects = [],
      freezeDuration = 0,
      onObjectsChange,
      onFreezeDurationChange,
      currentTime,
    } = props;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const {
      toolbarRef,
      position: toolbarPosition,
      isDragging: isDraggingToolbar,
      handleDragStart: handleToolbarDragStart,
    } = useDraggableToolbar({
      initialPosition: { x: DEFAULT_TOOLBAR_X, y: DEFAULT_TOOLBAR_Y },
    });
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
      null,
    );
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(
      null,
    );
    const dragObjectStartRef = useRef<{ x: number; y: number } | null>(null);

    const [objects, setObjects] = useState<DrawingObject[]>(initialObjects);
    const [currentObject, setCurrentObject] = useState<DrawingObject | null>(
      null,
    );
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const {
      tool,
      setTool,
      color,
      setColor,
      strokeWidth,
      setStrokeWidth,
      localFreezeDuration,
      setLocalFreezeDuration,
      colors,
    } = useAnnotationToolbarState({
      freezeDuration,
      minFreezeDuration: MIN_FREEZE_UI_SECONDS,
    });

    // Initialize from props when not actively drawing
    // Update objects when initialObjects change, but only when not in drawing mode
    useEffect(() => {
      if (!isActive) {
        setObjects(initialObjects);
      }
    }, [initialObjects, isActive, target]);

    // Render only objects whose timestamp matches currentTime (±0.1s)
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

      // タイムスタンプに基づいてオブジェクトをフィルタリング
      // 描画モード・再生モードに関わらず、現在のタイムスタンプに合致するもののみ表示
      const filteredObjects =
        typeof currentTime === 'number'
          ? objects.filter((obj) => {
              const timeDiff = Math.abs(obj.timestamp - currentTime);
              return timeDiff <= TIMESTAMP_TOLERANCE;
            })
          : objects;

      const displayObjects = filteredObjects.map((obj) =>
        scaleObjectForDisplay(obj, displayTarget),
      );
      const displayCurrent = currentObject
        ? scaleObjectForDisplay(currentObject, displayTarget)
        : null;

      displayObjects.forEach((obj) => renderObject(ctx, obj));
      if (displayCurrent) {
        renderObject(ctx, displayCurrent);
      }
      // highlight selection
      if (selectedObjectId) {
        const selected = displayObjects.find((o) => o.id === selectedObjectId);
        if (selected) {
          ctx.save();
          ctx.strokeStyle = '#00bcd4';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 1;
          const bounds = getObjectBounds(selected);
          if (bounds) {
            ctx.strokeRect(
              bounds.minX - 4,
              bounds.minY - 4,
              bounds.maxX - bounds.minX + 8,
              bounds.maxY - bounds.minY + 8,
            );
          }
          ctx.restore();
        }
      }
    }, [
      objects,
      currentObject,
      currentTime,
      contentRect,
      width,
      height,
      isActive,
      selectedObjectId,
    ]);

    useEffect(() => {
      renderAllObjects();
    }, [renderAllObjects]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        setObjects([]);
        setCurrentObject(null);
        onObjectsChange?.([], target);
      },
      getObjects: () => objects,
      setObjects: (newObjects: DrawingObject[]) => {
        setObjects(newObjects);
        onObjectsChange?.(newObjects, target);
      },
      exportToDataUrl: () => {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL() : null;
      },
    }));

    const {
      handleStart,
      handleMove,
      handleEnd,
      handleDragExisting,
    } = useAnnotationPointerHandlers({
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
    });

    const { handleTextSubmit, handleUndo, handleClear } =
      useAnnotationActions({
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
      });

    // Freeze duration change
    const handleFreezeDurationChange = useCallback(
      (value: number) => {
        setLocalFreezeDuration(value);
        onFreezeDurationChange?.(value);
      },
      [onFreezeDurationChange],
    );

    return (
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        {/* Canvas */}
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
          onMouseDown={handleStart}
          onMouseMove={(e) => {
            if (tool === 'select' && draggingObjectId) {
              handleDragExisting(e);
            } else {
              handleMove(e);
            }
          }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={(e) => {
            if (tool === 'select' && draggingObjectId) {
              handleDragExisting(e);
            } else {
              handleMove(e);
            }
          }}
          onTouchEnd={handleEnd}
        />

        {textPosition && (
          <AnnotationTextInputOverlay
            width={width}
            height={height}
            textPosition={textPosition}
            textInput={textInput}
            color={color}
            onChange={setTextInput}
            onSubmit={handleTextSubmit}
            onCancel={() => {
              setTextPosition(null);
              setTextInput('');
            }}
          />
        )}

        <AnnotationToolbar
          isActive={isActive}
          toolbarRef={toolbarRef}
          position={toolbarPosition}
          isDragging={isDraggingToolbar}
          onDragStart={handleToolbarDragStart}
          tool={tool}
          onToolChange={setTool}
          colors={colors}
          color={color}
          onColorChange={setColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          canUndo={objects.length > 0}
          onUndo={handleUndo}
          onClear={handleClear}
          freezeDuration={localFreezeDuration}
          minFreezeDuration={MIN_FREEZE_UI_SECONDS}
          onFreezeDurationChange={handleFreezeDurationChange}
        />
      </Box>
    );
  },
);

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
