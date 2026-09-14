import {
  annotationAtTime,
  annotationOffsetAt,
  isAnnotationVisible,
  setAnnotationKeyframe,
} from '../../../shared/tactics/annotationMotion';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type {
  DrawingObject,
  DrawingToolType,
  AnnotationTarget,
} from '../../../types/playlist/core';
import {
  findObjectAtPoint,
  getObjectBounds,
  scaleObjectForDisplay,
  shiftObject,
} from '../components/annotationCanvasUtils';
import { resizeStudioObject } from './studioGeometry';

export interface StudioContentRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}
interface Params {
  enabled: boolean;
  seekRevision?: number;
  documentKey: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  contentRect: StudioContentRect;
  objects: DrawingObject[];
  tool: DrawingToolType;
  color: string;
  strokeWidth: number;
  opacity: number;
  fill: boolean;
  dashed: boolean;
  time: number;
  target: AnnotationTarget;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDrawComplete?: () => void;
  onCommit: (objects: DrawingObject[]) => void;
}
interface Gesture {
  key: string;
  time: number;
  pointerId: number;
  kind: 'draw' | 'move' | 'resize' | 'node';
  nodeIndex?: number;
  start: { x: number; y: number };
  original: DrawingObject;
  latest: DrawingObject;
  objects: DrawingObject[];
  changed: boolean;
}
export interface StudioGesture {
  displayObjects: DrawingObject[];
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  linkCount: number;
  finishLink: () => void;
  cancel: () => void;
}
export const useStudioGesture = (params: Params): StudioGesture => {
  const gestureKey = `${params.documentKey}:${params.seekRevision ?? 0}:${params.enabled}`;
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{
    key: string;
    objects: DrawingObject[];
  } | null>(null);
  useEffect(
    () => () => {
      gesture.current = null;
      setPreview(null);
    },
    [gestureKey],
  );
  // pause/timeupdate can settle a fraction of a frame after pointerdown.
  // Explicit seeks use their own revision; a clock discontinuity still cancels.
  const isCurrent = (current: Gesture): boolean =>
    current.key === gestureKey && Math.abs(params.time - current.time) <= 0.12;
  useEffect(() => {
    if (
      gesture.current &&
      Math.abs(params.time - gesture.current.time) > 0.12
    ) {
      gesture.current = null;
      setPreview(null);
    }
  }, [params.time]);
  const point = (
    event: PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          params.contentRect.width,
          ((event.clientX - rect.left) * canvas.width) /
            Math.max(1, rect.width) -
            params.contentRect.offsetX,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          params.contentRect.height,
          ((event.clientY - rect.top) * canvas.height) /
            Math.max(1, rect.height) -
            params.contentRect.offsetY,
        ),
      ),
    };
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!params.enabled || event.button !== 0 || params.contentRect.width <= 0)
      return;
    if (
      gesture.current &&
      gesture.current.pointerId >= 0 &&
      gesture.current.pointerId !== event.pointerId
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    const pending = gesture.current;
    if (
      params.tool === 'linkedDiscs' &&
      pending &&
      isCurrent(pending) &&
      pending.kind === 'draw'
    ) {
      pending.pointerId = event.pointerId;
      const path = pending.latest.path ?? [];
      if (
        path.length < 15 &&
        path.every((node) => Math.hypot(node.x - start.x, node.y - start.y) > 3)
      ) {
        pending.latest = {
          ...pending.latest,
          path: [...path, start],
          endX: start.x,
          endY: start.y,
        };
        pending.changed = true;
        setPreview({
          key: pending.key,
          objects: [...pending.objects, pending.latest],
        });
      }
      return;
    }
    if (params.tool === 'select') {
      const display = params.objects
        .filter((object) => isAnnotationVisible(object, params.time))
        .map((object) =>
          scaleObjectForDisplay(annotationAtTime(object, params.time), {
            ...params.contentRect,
            offsetX: 0,
            offsetY: 0,
          }),
        );
      const selected = display.find(
        (object) => object.id === params.selectedId,
      );
      const bounds = selected && getObjectBounds(selected);
      const nodeIndex =
        selected &&
        (selected.type === 'linkedDiscs' ||
          (selected.type === 'polygon' && (selected.path?.length ?? 0) <= 12))
          ? (selected.path?.findIndex(
              (node) => Math.hypot(start.x - node.x, start.y - node.y) < 12,
            ) ?? -1)
          : -1;
      const resize =
        bounds && Math.hypot(start.x - bounds.maxX, start.y - bounds.maxY) < 14;
      const hit =
        nodeIndex >= 0 || resize
          ? selected
          : findObjectAtPoint(display, start.x, start.y, 6);
      params.onSelect(hit?.id ?? null);
      const original = params.objects.find((object) => object.id === hit?.id);
      if (!original) return;
      gesture.current = {
        key: gestureKey,
        time: params.time,
        pointerId: event.pointerId,
        kind: nodeIndex >= 0 ? 'node' : resize ? 'resize' : 'move',
        nodeIndex,
        start,
        original,
        latest: original,
        objects: params.objects,
        changed: false,
      };
    } else {
      const object: DrawingObject = {
        id: crypto.randomUUID(),
        type: params.tool,
        color: params.color,
        strokeWidth: params.strokeWidth,
        opacity: params.opacity,
        fill: params.fill,
        dashed: params.dashed,
        startX: start.x,
        startY: start.y,
        endX: start.x,
        endY: start.y,
        path: ['pen', 'polygon', 'linkedDiscs'].includes(params.tool)
          ? [start]
          : undefined,
        curvature: params.tool === 'curvedArrow' ? -0.3 : undefined,
        discRadius: params.tool === 'linkedDiscs' ? 22 : undefined,
        text: params.tool === 'text' ? 'テキスト' : undefined,
        fontSize: 28,
        timestamp: params.time,
        target: params.target,
        baseWidth: params.contentRect.width,
        baseHeight: params.contentRect.height,
      };
      gesture.current = {
        key: gestureKey,
        time: params.time,
        pointerId: event.pointerId,
        kind: 'draw',
        start,
        original: object,
        latest: object,
        objects: params.objects,
        changed: params.tool === 'text',
      };
      setPreview({
        key: gestureKey,
        objects: [...params.objects, object],
      });
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = gesture.current;
    if (
      !current ||
      !isCurrent(current) ||
      current.pointerId !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    )
      return;
    if (current.kind === 'draw' && current.latest.type === 'linkedDiscs')
      return;
    const at = point(event);
    const dx = at.x - current.start.x;
    const dy = at.y - current.start.y;
    current.changed ||= Math.hypot(dx, dy) > 2;
    if (current.kind === 'draw') {
      current.latest = {
        ...current.latest,
        endX: at.x,
        endY: at.y,
        path: current.latest.path ? [...current.latest.path, at] : undefined,
      };
    } else {
      const baseDx =
        (dx * (current.original.baseWidth ?? params.contentRect.width)) /
        params.contentRect.width;
      const baseDy =
        (dy * (current.original.baseHeight ?? params.contentRect.height)) /
        params.contentRect.height;
      const bounds = getObjectBounds(current.original);
      current.latest =
        current.kind === 'node'
          ? {
              ...current.original,
              path: current.original.path?.map((node, index) =>
                index === current.nodeIndex
                  ? { x: node.x + baseDx, y: node.y + baseDy }
                  : node,
              ),
            }
          : current.kind === 'resize' && bounds
            ? resizeStudioObject(
                current.original,
                bounds.maxX - bounds.minX + baseDx,
                bounds.maxY - bounds.minY + baseDy,
              )
            : current.original.motion
              ? setAnnotationKeyframe(current.original, current.time, {
                  x:
                    annotationOffsetAt(current.original, current.time).x +
                    baseDx,
                  y:
                    annotationOffsetAt(current.original, current.time).y +
                    baseDy,
                })
              : shiftObject(current.original, baseDx, baseDy);
    }
    setPreview({
      key: current.key,
      objects:
        current.kind === 'draw'
          ? [...current.objects, current.latest]
          : current.objects.map((object) =>
              object.id === current.latest.id ? current.latest : object,
            ),
    });
  };
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (
      current?.kind === 'draw' &&
      current.latest.type === 'linkedDiscs' &&
      isCurrent(current)
    ) {
      current.pointerId = -1;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    // pointermove can be coalesced or omitted during a quick drag.
    onPointerMove(event);
    gesture.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!params.enabled || !current || !isCurrent(current) || !current.changed)
      return;
    params.onCommit(
      current.kind === 'draw'
        ? [...current.objects, current.latest]
        : current.objects.map((object) =>
            object.id === current.latest.id ? current.latest : object,
          ),
    );
    params.onSelect(current.latest.id);
    if (current.kind === 'draw') params.onDrawComplete?.();
  };
  const cancel = (): void => {
    gesture.current = null;
    setPreview(null);
  };
  const finishLink = (): void => {
    const current = gesture.current;
    if (
      !params.enabled ||
      !current ||
      !isCurrent(current) ||
      current.latest.type !== 'linkedDiscs' ||
      (current.latest.path?.length ?? 0) < 2
    )
      return;
    params.onCommit([...current.objects, current.latest]);
    params.onSelect(current.latest.id);
    cancel();
    params.onDrawComplete?.();
  };
  return {
    linkCount:
      preview?.key === gestureKey &&
      gesture.current?.latest.type === 'linkedDiscs'
        ? (gesture.current.latest.path?.length ?? 0)
        : 0,
    finishLink,
    displayObjects:
      preview?.key === gestureKey ? preview.objects : params.objects,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      onLostPointerCapture: () => {
        if (
          gesture.current?.latest.type !== 'linkedDiscs' ||
          gesture.current.kind !== 'draw'
        )
          cancel();
      },
    },
    cancel,
  };
};
