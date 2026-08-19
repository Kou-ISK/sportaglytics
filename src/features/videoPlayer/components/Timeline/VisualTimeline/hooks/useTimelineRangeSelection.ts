import { useCallback, useMemo, useState } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from '../domain/timelineCoordinateMapper';

interface Point {
  x: number;
  y: number;
}

interface UseTimelineRangeSelectionParams {
  timeline: TimelineData[];
  selectedIds: string[];
  getContainerPoint: (clientX: number, clientY: number) => Point;
  getContainerSize: () => { width: number; height: number };
  getLaneBounds: (actionName: string) => { top: number; bottom: number };
  contentXToTime: (positionPx: number) => number;
  onSelectionChange: (ids: string[]) => void;
  onSelectionApplied?: () => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const useTimelineRangeSelection = ({
  timeline,
  selectedIds,
  getContainerPoint,
  getContainerSize,
  getLaneBounds,
  contentXToTime,
  onSelectionChange,
  onSelectionApplied,
}: UseTimelineRangeSelectionParams) => {
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [baseSelection, setBaseSelection] = useState<string[]>([]);
  const [isAdditive, setIsAdditive] = useState(false);

  const isSelecting = dragStart !== null && dragEnd !== null;

  const selectionBox = useMemo(() => {
    if (!dragStart || !dragEnd) return null;
    const { width: containerWidth, height: containerHeight } = getContainerSize();

    const rawLeft = Math.min(dragStart.x, dragEnd.x);
    const rawRight = Math.max(dragStart.x, dragEnd.x);
    const rawTop = Math.min(dragStart.y, dragEnd.y);
    const rawBottom = Math.max(dragStart.y, dragEnd.y);

    if (rawRight - rawLeft < 3 && rawBottom - rawTop < 3) return null;

    const left = clamp(rawLeft, 0, containerWidth);
    const right = clamp(rawRight, 0, containerWidth);
    const top = clamp(rawTop, 0, containerHeight);
    const bottom = clamp(rawBottom, 0, containerHeight);

    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [dragEnd, dragStart, getContainerSize]);

  const clearSelectionBox = useCallback((): void => {
    setDragStart(null);
    setDragEnd(null);
    setIsAdditive(false);
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent): void => {
      if (event.button !== 0) return;
      const point = getContainerPoint(event.clientX, event.clientY);
      setBaseSelection(selectedIds);
      setIsAdditive(event.metaKey || event.ctrlKey || event.shiftKey);
      setDragStart(point);
      setDragEnd(point);
    },
    [getContainerPoint, selectedIds],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent): void => {
      if (!dragStart) return;
      setDragEnd(getContainerPoint(event.clientX, event.clientY));
    },
    [dragStart, getContainerPoint],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent): void => {
      if (!dragStart || !dragEnd) return;
      const endPoint = getContainerPoint(event.clientX, event.clientY);
      setDragEnd(endPoint);

      const deltaX = Math.abs(dragStart.x - endPoint.x);
      const deltaY = Math.abs(dragStart.y - endPoint.y);
      if (deltaX < 3 && deltaY < 3) {
        clearSelectionBox();
        return;
      }

      const leftContainerX = Math.min(dragStart.x, endPoint.x);
      const rightContainerX = Math.max(dragStart.x, endPoint.x);
      const leftContentX = Math.max(
        0,
        leftContainerX - TIMELINE_ROW_HEADER_WIDTH_PX,
      );
      const rightContentX = Math.max(
        0,
        rightContainerX - TIMELINE_ROW_HEADER_WIDTH_PX,
      );
      const leftTime = contentXToTime(leftContentX);
      const rightTime = contentXToTime(rightContentX);

      const topY = Math.max(0, Math.min(dragStart.y, endPoint.y));
      const bottomY = Math.max(dragStart.y, endPoint.y);

      const rangeSelectedIds = timeline
        .map((item) => {
          const { top, bottom } = getLaneBounds(item.actionName);
          const overlapX =
            Math.max(leftTime, item.startTime) <=
            Math.min(rightTime, item.endTime);
          const overlapY = Math.max(topY, top) <= Math.min(bottomY, bottom);
          return overlapX && overlapY ? item.id : null;
        })
        .filter((id): id is string => Boolean(id));

      const finalIds = isAdditive
        ? Array.from(new Set([...baseSelection, ...rangeSelectedIds]))
        : rangeSelectedIds;

      onSelectionChange(finalIds);
      onSelectionApplied?.();
      clearSelectionBox();
    },
    [
      baseSelection,
      clearSelectionBox,
      contentXToTime,
      dragEnd,
      dragStart,
      getContainerPoint,
      getLaneBounds,
      isAdditive,
      onSelectionApplied,
      onSelectionChange,
      timeline,
    ],
  );

  return {
    isSelecting,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelectionBox,
  };
};
