/**
 * アノテーション描画キャンバス
 * Sportscode風：図形（矩形、円、矢印、線）、フリーハンド、テキスト対応
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { AnnotationTarget, DrawingObject } from '../../../types/Playlist';
import { useDraggableToolbar } from '../hooks/annotation/useDraggableToolbar';
import { useAnnotationPointerHandlers } from '../hooks/annotation/useAnnotationPointerHandlers';
import { useAnnotationActions } from '../hooks/annotation/useAnnotationActions';
import { useAnnotationToolbarState } from '../hooks/annotation/useAnnotationToolbarState';
import { useAnnotationCanvasRendering } from '../hooks/annotation/useAnnotationCanvasRendering';
import { AnnotationCanvasView } from './AnnotationCanvasView';

const TIMESTAMP_TOLERANCE = 0.12;
const MIN_FREEZE_UI_SECONDS = 1;
const DEFAULT_TOOLBAR_X = 6;
const DEFAULT_TOOLBAR_Y = 60;

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
  currentTime?: number;
}

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
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDrawingRef = useRef(false);
    const dragObjectStartRef = useRef<{ x: number; y: number } | null>(null);

    const { toolbarRef, position, isDragging, handleDragStart } =
      useDraggableToolbar({
        initialPosition: { x: DEFAULT_TOOLBAR_X, y: DEFAULT_TOOLBAR_Y },
      });

    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
    const [objects, setObjects] = useState<DrawingObject[]>(initialObjects);
    const [currentObject, setCurrentObject] = useState<DrawingObject | null>(null);
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(
      null,
    );

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

    useEffect(() => {
      if (!isActive) {
        setObjects(initialObjects);
      }
    }, [initialObjects, isActive, target]);

    useAnnotationCanvasRendering({
      canvasRef,
      objects,
      currentObject,
      currentTime,
      contentRect,
      width,
      height,
      selectedObjectId,
      timestampTolerance: TIMESTAMP_TOLERANCE,
    });

    useImperativeHandle(
      ref,
      () => ({
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
        exportToDataUrl: () => canvasRef.current?.toDataURL() ?? null,
      }),
      [objects, onObjectsChange, target],
    );

    const { handleStart, handleMove, handleEnd, handleDragExisting } =
      useAnnotationPointerHandlers({
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

    const { handleTextSubmit, handleUndo, handleClear } = useAnnotationActions({
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

    const handleFreezeDurationChange = useCallback(
      (value: number) => {
        setLocalFreezeDuration(value);
        onFreezeDurationChange?.(value);
      },
      [onFreezeDurationChange, setLocalFreezeDuration],
    );

    const handleTextCancel = useCallback(() => {
      setTextPosition(null);
      setTextInput('');
    }, []);

    return (
      <AnnotationCanvasView
        containerRef={containerRef}
        canvasRef={canvasRef}
        width={width}
        height={height}
        isActive={isActive}
        tool={tool}
        draggingObjectId={draggingObjectId}
        onStart={handleStart}
        onMove={handleMove}
        onDragExisting={handleDragExisting}
        onEnd={handleEnd}
        textPosition={textPosition}
        textInput={textInput}
        color={color}
        onTextInputChange={setTextInput}
        onTextSubmit={handleTextSubmit}
        onTextCancel={handleTextCancel}
        toolbarRef={toolbarRef}
        toolbarPosition={position}
        isDraggingToolbar={isDragging}
        onToolbarDragStart={handleDragStart}
        onToolChange={setTool}
        colors={colors}
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
    );
  },
);

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
