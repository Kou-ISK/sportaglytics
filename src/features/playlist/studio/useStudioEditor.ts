import { useStudioKeyframes } from './useStudioKeyframes';
import type { StudioKeyframeControls } from './useStudioKeyframes';
import type { TrackingTargetOverlayProps } from './TrackingTargetOverlayView';
import {
  annotationOffsetAt,
  setAnnotationKeyframe,
} from '../../../shared/tactics/annotationMotion';
import type { ChromaKey } from '../../../shared/tactics/chromaKey';
import { useTacticsMotion } from './useTacticsMotion';
import type { TacticsMotionProps } from './useTacticsMotion';
import { useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  DrawingToolType,
} from '../../../types/playlist/core';
import { shiftObject } from '../components/annotationCanvasUtils';
import { useAnnotationCanvasRendering } from '../hooks/annotation/useAnnotationCanvasRendering';
import { moveStudioLayer } from './studioGeometry';
import { useStudioGesture } from './useStudioGesture';
import type { StudioContentRect, StudioGesture } from './useStudioGesture';

export interface StudioEditorParams {
  seekRevision?: number;
  onTogglePlayback?: () => void;
  onToolSelected?: () => void;
  chromaKey?: ChromaKey;
  videoRef?: RefObject<HTMLVideoElement | null>;
  maxTime?: number;
  documentKey: string;
  enabled: boolean;
  objects: DrawingObject[];
  time: number;
  target: AnnotationTarget;
  width: number;
  height: number;
  contentRect: StudioContentRect;
  onCommit: (objects: DrawingObject[]) => void;
  onSeek: (time: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
export interface StudioEditor {
  keyframes: StudioKeyframeControls;
  canvas: StudioGesture['handlers'] & {
    trackingTarget?: Omit<TrackingTargetOverlayProps, 'width' | 'height'>;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    width: number;
    height: number;
    enabled: boolean;
    tool: DrawingToolType;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
  inspector: {
    inspectorCollapsed: boolean;
    onToggleInspector: () => void;
    renderError: string;
    motion: TacticsMotionProps;
    enabled: boolean;
    objects: DrawingObject[];
    selected: DrawingObject | null;
    selectedId: string | null;
    tool: DrawingToolType;
    linkCount: number;
    onFinishLink: () => void;
    onCancelLink: () => void;
    color: string;
    strokeWidth: number;
    opacity: number;
    fill: boolean;
    dashed: boolean;
    onToolChange: (tool: DrawingToolType) => void;
    onColorChange: (color: string) => void;
    onStrokeWidthChange: (width: number) => void;
    onOpacityChange: (opacity: number) => void;
    onFillChange: (fill: boolean) => void;
    onDashedChange: (dashed: boolean) => void;
    onSelect: (id: string) => void;
    onUpdate: (patch: Partial<DrawingObject>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveLayer: (direction: -1 | 1) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}
export const useStudioEditor = (params: StudioEditorParams): StudioEditor => {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selection, setSelection] = useState<{
    key: string;
    id: string | null;
  }>({ key: '', id: null });
  const [tool, setTool] = useState<DrawingToolType>('select');
  const [color, setColor] = useState('#FFD60A');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [fill, setFill] = useState(false);
  const [dashed, setDashed] = useState(false);
  const selectedId = selection.key === params.documentKey ? selection.id : null;
  const selected =
    params.objects.find((object) => object.id === selectedId) ?? null;
  const select = (id: string | null): void => {
    keyframes.onClear();
    setSelection({ key: params.documentKey, id });
  };
  const keyframes = useStudioKeyframes({
    documentKey: params.documentKey,
    objects: params.objects,
    selectedId,
    enabled: params.enabled,
    onSelectObject: (id) => {
      gesture.cancel();
      setSelection({ key: params.documentKey, id });
      setTool('select');
    },
    onCommit: params.onCommit,
    onSeek: params.onSeek,
  });
  const gesture = useStudioGesture({
    ...params,
    canvasRef,
    tool,
    color,
    strokeWidth,
    opacity,
    fill,
    dashed,
    selectedId,
    onSelect: select,
    onDrawComplete: () => setTool('select'),
  });
  const renderError = useAnnotationCanvasRendering({
    chromaKey: params.chromaKey,
    videoRef: params.videoRef,
    canvasRef,
    objects: gesture.displayObjects,
    currentObject: null,
    currentTime: params.time,
    contentRect: params.contentRect,
    width: params.width,
    height: params.height,
    selectedObjectId: selectedId,
    timestampTolerance: 0.12,
  });
  const update = (patch: Partial<DrawingObject>): void => {
    if (!selected || !params.enabled) return;
    params.onCommit(
      params.objects.map((object) =>
        object.id === selected.id ? { ...object, ...patch } : object,
      ),
    );
  };
  const motion = useTacticsMotion(
    selected,
    params.time,
    params.maxTime ?? params.time + 30,
    update,
  );
  const remove = (): void => {
    if (selected && params.enabled) {
      canvasRef.current?.focus();
      params.onCommit(
        params.objects.filter((object) => object.id !== selected.id),
      );
      select(null);
    }
  };
  const duplicate = (): void => {
    if (!selected || !params.enabled) return;
    const copy = { ...shiftObject(selected, 20, 20), id: crypto.randomUUID() };
    params.onCommit([...params.objects, copy]);
    select(copy.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const element = event.target;
    if (
      element instanceof HTMLElement &&
      element.closest('input,textarea,select,[contenteditable="true"]')
    )
      return;
    if (
      event.code === 'Space' &&
      params.onTogglePlayback &&
      !(
        element instanceof HTMLElement &&
        element.closest('button,[role="button"]')
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      gesture.cancel();
      params.onTogglePlayback();
      return;
    }
    if (['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (!params.enabled || event.repeat) return;
      gesture.cancel();
      if (keyframes.active) keyframes.onDelete();
      else remove();
      return;
    }
    if (!params.enabled) return;
    if (event.key === 'Enter' && gesture.linkCount >= 2) {
      event.preventDefault();
      event.stopPropagation();
      gesture.finishLink();
      return;
    }
    const command = event.metaKey || event.ctrlKey;
    const shortcuts: Record<string, DrawingToolType> = {
      v: 'select',
      p: 'pen',
      a: 'arrow',
      r: 'rectangle',
      o: 'circle',
      t: 'text',
    };
    const nextTool = shortcuts[event.key.toLowerCase()];
    if (!command && !event.altKey && nextTool) {
      event.preventDefault();
      event.stopPropagation();
      gesture.cancel();
      if (nextTool !== 'select') {
        select(null);
        params.onToolSelected?.();
      }
      setTool(nextTool);
      return;
    }
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.stopPropagation();
      gesture.cancel();
      (event.shiftKey ? params.onRedo : params.onUndo)();
    } else if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      event.stopPropagation();
      duplicate();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      gesture.cancel();
      select(null);
      setTool('select');
    } else if (
      selected &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 10 : 1;
      const dx =
        event.key === 'ArrowLeft'
          ? -step
          : event.key === 'ArrowRight'
            ? step
            : 0;
      const dy =
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      const offset = annotationOffsetAt(selected, params.time);
      update(
        selected.motion
          ? setAnnotationKeyframe(selected, params.time, {
              x: offset.x + dx,
              y: offset.y + dy,
            })
          : shiftObject(selected, dx, dy),
      );
    }
  };
  return {
    keyframes,
    canvas: {
      canvasRef,
      width: params.width,
      height: params.height,
      enabled: params.enabled,
      tool,
      ...gesture.handlers,
      onKeyDown,
    },
    inspector: {
      inspectorCollapsed,
      onToggleInspector: () => setInspectorCollapsed((value) => !value),
      linkCount: gesture.linkCount,
      onFinishLink: gesture.finishLink,
      onCancelLink: gesture.cancel,
      renderError,
      motion,
      enabled: params.enabled,
      objects: params.objects,
      selected,
      selectedId,
      tool,
      color,
      strokeWidth,
      opacity,
      fill,
      dashed,
      onToolChange: (value: DrawingToolType): void => {
        gesture.cancel();
        if (value !== 'select') {
          select(null);
          params.onToolSelected?.();
        }
        setTool(value);
      },
      onColorChange: (value: string): void => {
        setColor(value);
        update({ color: value });
      },
      onStrokeWidthChange: (value: number): void => {
        setStrokeWidth(value);
        update({ strokeWidth: value });
      },
      onOpacityChange: (value: number): void => {
        setOpacity(value);
        update({ opacity: value });
      },
      onFillChange: (value: boolean): void => {
        setFill(value);
        update({ fill: value });
      },
      onDashedChange: (value: boolean): void => {
        setDashed(value);
        update({ dashed: value });
      },
      onSelect: (id: string): void => {
        gesture.cancel();
        select(id);
        setTool('select');
        const object = params.objects.find((entry) => entry.id === id);
        if (object) params.onSeek(object.timestamp);
      },
      onUpdate: update,
      onDelete: remove,
      onDuplicate: duplicate,
      onMoveLayer: (direction: -1 | 1): void => {
        if (selected && params.enabled)
          params.onCommit(
            moveStudioLayer(params.objects, selected.id, direction),
          );
      },
      onUndo: (): void => {
        gesture.cancel();
        params.onUndo();
      },
      onRedo: (): void => {
        gesture.cancel();
        params.onRedo();
      },
      canUndo: params.canUndo,
      canRedo: params.canRedo,
      onKeyDown,
    },
  };
};
