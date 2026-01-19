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
  DrawingToolType,
} from '../../../types/Playlist';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationTextInputOverlay } from './AnnotationTextInputOverlay';
import {
  findObjectAtPoint,
  generateAnnotationId,
  renderObject,
  scaleObjectForDisplay,
  shiftObject,
} from './annotationCanvasUtils';

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
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
    const [toolbarPosition, setToolbarPosition] = useState<{
      x: number;
      y: number;
    }>({
      x: DEFAULT_TOOLBAR_X,
      y: DEFAULT_TOOLBAR_Y,
    });
    const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
      null,
    );
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(
      null,
    );
    const dragObjectStartRef = useRef<{ x: number; y: number } | null>(null);

    const [tool, setTool] = useState<DrawingToolType>('pen');
    const [color, setColor] = useState<string>('#ff0000');
    const [strokeWidth, setStrokeWidth] = useState<number>(3);
    const [objects, setObjects] = useState<DrawingObject[]>(initialObjects);
    const [currentObject, setCurrentObject] = useState<DrawingObject | null>(
      null,
    );
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [localFreezeDuration, setLocalFreezeDuration] =
      useState<number>(freezeDuration);

    const colors = [
      '#ff0000',
      '#ff7f00',
      '#ff00ff',
      '#ffff00',
      '#00ff00',
      '#00ffff',
      '#0066ff',
      '#9900ff',
      '#ffffff',
      '#000000',
    ];

    // Initialize from props when not actively drawing
    // Update objects when initialObjects change, but only when not in drawing mode
    useEffect(() => {
      if (!isActive) {
        setObjects(initialObjects);
      }
    }, [initialObjects, isActive, target]);

    useEffect(() => {
      setLocalFreezeDuration(
        freezeDuration < MIN_FREEZE_UI_SECONDS
          ? MIN_FREEZE_UI_SECONDS
          : freezeDuration,
      );
    }, [freezeDuration]);

    // Clamp toolbar inside viewport on resize
    useEffect(() => {
      const clamp = () => {
        const toolbar = toolbarRef.current;
        if (!toolbar) return;
        const tw = toolbar.offsetWidth || 0;
        const th = toolbar.offsetHeight || 0;
        setToolbarPosition((pos) => ({
          x: Math.min(
            Math.max(0, pos.x),
            Math.max(0, window.innerWidth - tw - 8),
          ),
          y: Math.min(
            Math.max(0, pos.y),
            Math.max(0, window.innerHeight - th - 8),
          ),
        }));
      };
      clamp();
      window.addEventListener('resize', clamp);
      return () => window.removeEventListener('resize', clamp);
    }, []);

    // Drag handlers for toolbar
    const handleToolbarDragStart = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const toolbarRect = toolbar.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - toolbarRect.left,
        y: e.clientY - toolbarRect.top,
      };
      setIsDraggingToolbar(true);
    }, []);

    useEffect(() => {
      if (!isDraggingToolbar) return;

      const handleMove = (e: MouseEvent) => {
        const offset = dragOffsetRef.current;
        const toolbar = toolbarRef.current;
        if (!toolbar || !offset) return;

        const newX = e.clientX - offset.x;
        const newY = e.clientY - offset.y;
        setToolbarPosition({
          x: Math.min(
            Math.max(0, newX),
            Math.max(0, window.innerWidth - (toolbar.offsetWidth || 0) - 8),
          ),
          y: Math.min(
            Math.max(0, newY),
            Math.max(0, window.innerHeight - (toolbar.offsetHeight || 0) - 8),
          ),
        });
      };

      const handleUp = () => {
        setIsDraggingToolbar(false);
        dragOffsetRef.current = null;
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }, [isDraggingToolbar]);

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

    // Get canvas coordinates from event
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
        return {
          x,
          y,
        };
      },
      [contentRect, width, height],
    );

    // Mouse/Touch handlers
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
          const hit = findObjectAtPoint(displayObjects, coords);
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
        isActive,
        tool,
        color,
        strokeWidth,
        getCanvasCoords,
        currentTime,
        target,
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
      [isActive, tool, currentObject, getCanvasCoords],
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
      objects,
      tool,
      onObjectsChange,
      target,
      draggingObjectId,
    ]);

    // Text submission
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
      textPosition,
      textInput,
      color,
      strokeWidth,
      objects,
      onObjectsChange,
      currentTime,
      target,
    ]);

    // Undo last object
    const handleUndo = useCallback(() => {
      if (objects.length === 0) return;
      const newObjects = objects.slice(0, -1);
      setObjects(newObjects);
      onObjectsChange?.(newObjects, target);
    }, [objects, onObjectsChange, target]);

    // Clear all
    const handleClear = useCallback(() => {
      setObjects([]);
      setCurrentObject(null);
      onObjectsChange?.([], target);
      setSelectedObjectId(null);
    }, [onObjectsChange, target]);

    // Move existing object
    const handleDragExisting = useCallback(
      (e: React.MouseEvent | React.TouchEvent) => {
        if (!isActive || tool !== 'select' || !draggingObjectId) return;
        const start = dragObjectStartRef.current;
        if (!start) return;
        const coords = getCanvasCoords(e);
        const dx = coords.x - start.x;
        const dy = coords.y - start.y;
        dragObjectStartRef.current = coords;

        const selected = objects.find((o) => o.id === draggingObjectId);
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
        draggingObjectId,
        getCanvasCoords,
        isActive,
        tool,
        onObjectsChange,
        target,
        objects,
        contentRect,
        width,
        height,
      ],
    );

    // Delete selected with Delete/Backspace
    useEffect(() => {
      if (!isActive) return;
      const handler = (e: KeyboardEvent) => {
        if (!selectedObjectId) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
          setObjects((prev) => {
            const filtered = prev.filter((o) => o.id !== selectedObjectId);
            onObjectsChange?.(filtered, target);
            return filtered;
          });
          setSelectedObjectId(null);
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [selectedObjectId, onObjectsChange, target, isActive]);

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
