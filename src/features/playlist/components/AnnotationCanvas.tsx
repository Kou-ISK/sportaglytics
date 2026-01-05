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
import {
  Box,
  Divider,
  IconButton,
  Portal,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowRightAlt,
  Brush,
  Clear,
  CropSquare,
  PauseCircle,
  RadioButtonUnchecked,
  TextFields,
  Timeline,
  Undo,
  DragIndicator,
  OpenWith,
} from '@mui/icons-material';
import type {
  AnnotationTarget,
  DrawingObject,
  DrawingToolType,
} from '../../../types/Playlist';

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

// ===== Helper Functions =====
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLength: number = 15,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function renderObject(ctx: CanvasRenderingContext2D, obj: DrawingObject) {
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = obj.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (obj.type) {
    case 'pen':
      if (obj.path && obj.path.length > 1) {
        ctx.beginPath();
        ctx.moveTo(obj.path[0].x, obj.path[0].y);
        for (let i = 1; i < obj.path.length; i++) {
          ctx.lineTo(obj.path[i].x, obj.path[i].y);
        }
        ctx.stroke();
      }
      break;

    case 'line':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
      }
      break;

    case 'arrow':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
        drawArrowHead(ctx, obj.startX, obj.startY, obj.endX, obj.endY);
      }
      break;

    case 'rectangle':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        const width = obj.endX - obj.startX;
        const height = obj.endY - obj.startY;
        if (obj.fill) {
          ctx.globalAlpha = 0.3;
          ctx.fillRect(obj.startX, obj.startY, width, height);
          ctx.globalAlpha = 1;
        }
        ctx.strokeRect(obj.startX, obj.startY, width, height);
      }
      break;

    case 'circle':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        const radiusX = Math.abs(obj.endX - obj.startX) / 2;
        const radiusY = Math.abs(obj.endY - obj.startY) / 2;
        const centerX = (obj.startX + obj.endX) / 2;
        const centerY = (obj.startY + obj.endY) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (obj.fill) {
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
      }
      break;

    case 'text':
      if (obj.text) {
        ctx.font = `${obj.fontSize || 24}px sans-serif`;
        ctx.fillText(obj.text, obj.startX, obj.startY);
      }
      break;
  }
}

function scaleObjectForDisplay(
  obj: DrawingObject,
  target: { width: number; height: number; offsetX: number; offsetY: number },
) {
  const scaleX = target.width / (obj.baseWidth ?? target.width);
  const scaleY = target.height / (obj.baseHeight ?? target.height);
  const transformPoint = (p: { x: number; y: number }) => ({
    x: p.x * scaleX + target.offsetX,
    y: p.y * scaleY + target.offsetY,
  });
  switch (obj.type) {
    case 'pen':
      return {
        ...obj,
        path: obj.path?.map(transformPoint),
      };
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'circle':
      return {
        ...obj,
        startX: obj.startX * scaleX + target.offsetX,
        startY: obj.startY * scaleY + target.offsetY,
        endX:
          obj.endX !== undefined
            ? obj.endX * scaleX + target.offsetX
            : obj.endX,
        endY:
          obj.endY !== undefined
            ? obj.endY * scaleY + target.offsetY
            : obj.endY,
        strokeWidth: obj.strokeWidth * ((scaleX + scaleY) / 2),
      };
    case 'text':
      return {
        ...obj,
        startX: obj.startX * scaleX + target.offsetX,
        startY: obj.startY * scaleY + target.offsetY,
        fontSize: (obj.fontSize || 24) * ((scaleX + scaleY) / 2),
      };
    default:
      return obj;
  }
}

function getObjectBounds(obj: DrawingObject) {
  switch (obj.type) {
    case 'pen':
      if (!obj.path || obj.path.length === 0) return null;
      return obj.path.reduce(
        (acc, p) => ({
          minX: Math.min(acc.minX, p.x),
          minY: Math.min(acc.minY, p.y),
          maxX: Math.max(acc.maxX, p.x),
          maxY: Math.max(acc.maxY, p.y),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
    case 'line':
    case 'arrow': {
      const endX = obj.endX ?? obj.startX;
      const endY = obj.endY ?? obj.startY;
      return {
        minX: Math.min(obj.startX, endX),
        minY: Math.min(obj.startY, endY),
        maxX: Math.max(obj.startX, endX),
        maxY: Math.max(obj.startY, endY),
      };
    }
    case 'rectangle':
    case 'circle': {
      const endX = obj.endX ?? obj.startX;
      const endY = obj.endY ?? obj.startY;
      return {
        minX: Math.min(obj.startX, endX),
        minY: Math.min(obj.startY, endY),
        maxX: Math.max(obj.startX, endX),
        maxY: Math.max(obj.startY, endY),
      };
    }
    case 'text': {
      return {
        minX: obj.startX - 4,
        minY: obj.startY - (obj.fontSize || 24),
        maxX: obj.startX + 60,
        maxY: obj.startY + 8,
      };
    }
    default:
      return null;
  }
}

function pointInBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
) {
  return (
    x >= bounds.minX - HIT_TOLERANCE &&
    x <= bounds.maxX + HIT_TOLERANCE &&
    y >= bounds.minY - HIT_TOLERANCE &&
    y <= bounds.maxY + HIT_TOLERANCE
  );
}

function findObjectAtPoint(
  objects: DrawingObject[],
  point: { x: number; y: number },
) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const bounds = getObjectBounds(obj);
    if (!bounds) continue;
    if (pointInBounds(bounds, point.x, point.y)) {
      return obj;
    }
  }
  return null;
}

function shiftObject(
  obj: DrawingObject,
  dx: number,
  dy: number,
): DrawingObject {
  switch (obj.type) {
    case 'pen':
      return {
        ...obj,
        path: obj.path?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'circle':
      return {
        ...obj,
        startX: obj.startX + dx,
        startY: obj.startY + dy,
        endX: obj.endX !== undefined ? obj.endX + dx : obj.endX,
        endY: obj.endY !== undefined ? obj.endY + dy : obj.endY,
      };
    case 'text':
      return {
        ...obj,
        startX: obj.startX + dx,
        startY: obj.startY + dy,
      };
    default:
      return obj;
  }
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

    // Initialize from props
    useEffect(() => {
      setObjects(initialObjects);
    }, [initialObjects]);

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
      const filteredObjects =
        typeof currentTime === 'number'
          ? objects.filter(
              (obj) =>
                Math.abs(obj.timestamp - currentTime) <= TIMESTAMP_TOLERANCE,
            )
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
    }, [objects, currentObject, currentTime]);

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
          id: generateId(),
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
        id: generateId(),
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

        {/* Text Input Dialog */}
        {textPosition && (
          <Box
            sx={{
              position: 'absolute',
              left: `${(textPosition.x / width) * 100}%`,
              top: `${(textPosition.y / height) * 100}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: 10,
            }}
          >
            <Paper sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.9)' }}>
              <TextField
                size="small"
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTextSubmit();
                  if (e.key === 'Escape') {
                    setTextPosition(null);
                    setTextInput('');
                  }
                }}
                placeholder="テキストを入力..."
                sx={{ minWidth: 150 }}
              />
            </Paper>
          </Box>
        )}

        {isActive && (
          <Portal>
            <Paper
              ref={toolbarRef}
              sx={{
                position: 'fixed',
                top: toolbarPosition.y,
                left: toolbarPosition.x,
                p: 0.5,
                bgcolor: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(6px)',
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 0.4,
                boxShadow: 6,
                borderRadius: 2,
                zIndex: 2000,
                cursor: isDraggingToolbar ? 'grabbing' : 'default',
                userSelect: 'none',
                width: 'fit-content',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                onMouseDown={handleToolbarDragStart}
                sx={{
                  cursor: 'grab',
                  color: 'grey.300',
                  fontSize: 10,
                  pb: 0.25,
                }}
              >
                <DragIndicator fontSize="small" />
                <Typography variant="caption">移動</Typography>
              </Stack>

              {tool === 'select' && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 9.5,
                    color: 'grey.400',
                    lineHeight: 1.1,
                    px: 0.25,
                  }}
                >
                  クリック:選択
                  <br />
                  ドラッグ:移動
                  <br />
                  Delete:削除
                </Typography>
              )}

              {/* Tool Selection */}
              <ToggleButtonGroup
                value={tool}
                exclusive
                onChange={(_, value) => value && setTool(value)}
                size="small"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 0.25,
                  '& .MuiToggleButton-root': { minWidth: 28, height: 28, p: 0 },
                }}
              >
                <ToggleButton value="pen">
                  <Tooltip title="ペン">
                    <Brush fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="select">
                  <Tooltip title="選択/ドラッグで移動・Deleteで削除">
                    <OpenWith fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="line">
                  <Tooltip title="直線">
                    <Timeline fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="arrow">
                  <Tooltip title="矢印">
                    <ArrowRightAlt fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="rectangle">
                  <Tooltip title="四角形">
                    <CropSquare fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="circle">
                  <Tooltip title="円/楕円">
                    <RadioButtonUnchecked fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="text">
                  <Tooltip title="テキスト">
                    <TextFields fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              <Divider sx={{ borderColor: 'grey.700' }} />

              {/* Color Palette */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: 0.25,
                }}
              >
                {colors.map((c) => (
                  <IconButton
                    key={c}
                    size="small"
                    onClick={() => setColor(c)}
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: c,
                      border:
                        color === c ? '2px solid white' : '1px solid #666',
                      '&:hover': { bgcolor: c },
                    }}
                  />
                ))}
              </Box>

              <Divider sx={{ borderColor: 'grey.700' }} />

              {/* Stroke Width */}
              <Stack spacing={0.25} sx={{ px: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 10 }}>
                  太さ
                </Typography>
                <Slider
                  size="small"
                  value={strokeWidth}
                  min={1}
                  max={10}
                  onChange={(_, v) => setStrokeWidth(v as number)}
                  sx={{ width: '100%', mt: -0.5 }}
                />
              </Stack>

              <Divider sx={{ borderColor: 'grey.700' }} />

              {/* Actions */}
              <Stack direction="row" spacing={0.25}>
                <Tooltip title="元に戻す">
                  <IconButton
                    size="small"
                    onClick={handleUndo}
                    disabled={objects.length === 0}
                  >
                    <Undo fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="全てクリア">
                  <IconButton size="small" onClick={handleClear}>
                    <Clear fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Divider sx={{ borderColor: 'grey.700' }} />

              {/* Freeze Duration */}
              <Stack spacing={0.25} sx={{ px: 0.5 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PauseCircle
                    fontSize="small"
                    sx={{ color: 'warning.main' }}
                  />
                  <Typography variant="caption" sx={{ fontSize: 10 }}>
                    停止 {localFreezeDuration}秒
                  </Typography>
                </Stack>
                <Slider
                  size="small"
                  value={localFreezeDuration}
                  min={MIN_FREEZE_UI_SECONDS}
                  max={10}
                  step={0.5}
                  onChange={(_, v) => handleFreezeDurationChange(v as number)}
                  sx={{ width: '100%' }}
                />
              </Stack>
            </Paper>
          </Portal>
        )}
      </Box>
    );
  },
);

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
