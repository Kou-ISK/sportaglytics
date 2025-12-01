import { useCallback, useMemo, useState } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';

interface UseTimelineRangeSelectionParams {
  timeline: TimelineData[];
  selectedIds: string[];
  getSelectionMetrics: () => {
    rectLeft: number;
    rectTop: number;
    scrollLeft: number;
    scrollTop: number;
    laneOffset?: number;
    containerHeight?: number;
  };
  getLaneBounds: (actionName: string) => { top: number; bottom: number };
  onSelectionChange: (ids: string[]) => void;
}

type Point = { x: number; y: number };

export const useTimelineRangeSelection = ({
  timeline,
  selectedIds,
  getSelectionMetrics,
  getLaneBounds,
  onSelectionChange,
}: UseTimelineRangeSelectionParams) => {
  const [dragStartDisplay, setDragStartDisplay] = useState<Point | null>(null);
  const [dragEndDisplay, setDragEndDisplay] = useState<Point | null>(null);
  const [startScroll, setStartScroll] = useState<{ left: number; top: number }>(
    { left: 0, top: 0 },
  );
  const [baseSelection, setBaseSelection] = useState<string[]>([]);
  const [isAdditive, setIsAdditive] = useState(false);

  const isSelecting = dragStartDisplay !== null && dragEndDisplay !== null;

  const selectionBox = useMemo(() => {
    if (!dragStartDisplay || !dragEndDisplay) return null;
    const { containerHeight = Infinity } = getSelectionMetrics();

    const rawLeft = Math.min(dragStartDisplay.x, dragEndDisplay.x);
    const rawTop = Math.min(dragStartDisplay.y, dragEndDisplay.y);
    const rawWidth = Math.abs(dragStartDisplay.x - dragEndDisplay.x);
    const rawHeight = Math.abs(dragStartDisplay.y - dragEndDisplay.y);

    // ドラッグがほぼゼロの場合は表示しない（直線表示のちらつきを抑止）
    if (rawWidth < 3 && rawHeight < 3) return null;

    const top = Math.max(0, rawTop);
    const bottom = Math.min(containerHeight, rawTop + rawHeight);
    const height = Math.max(0, bottom - top);
    const left = rawLeft;
    const width = rawWidth;

    return { left, top, width, height };
  }, [dragStartDisplay, dragEndDisplay, getSelectionMetrics]);

  const clearSelectionBox = useCallback(() => {
    setDragStartDisplay(null);
    setDragEndDisplay(null);
    setIsAdditive(false);
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      const { rectLeft, rectTop, scrollLeft, scrollTop } =
        getSelectionMetrics();
      const point: Point = {
        x: event.clientX - rectLeft,
        y: event.clientY - rectTop,
      };
      setBaseSelection(selectedIds);
      setIsAdditive(event.metaKey || event.ctrlKey || event.shiftKey);
      setStartScroll({ left: scrollLeft, top: scrollTop });
      setDragStartDisplay(point);
      setDragEndDisplay(point);
    },
    [getSelectionMetrics, selectedIds],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!dragStartDisplay) return;
      const { rectLeft, rectTop } = getSelectionMetrics();
      setDragEndDisplay({
        x: event.clientX - rectLeft,
        y: event.clientY - rectTop,
      });
    },
    [dragStartDisplay, getSelectionMetrics],
  );

  const handleMouseUp = useCallback(
    (
      event: React.MouseEvent,
      positionToTime: (positionPx: number) => number,
    ) => {
      if (!dragStartDisplay || !dragEndDisplay) return;
      const { rectLeft, rectTop, scrollLeft, scrollTop, laneOffset = 0 } =
        getSelectionMetrics();
      const endDisplay: Point = {
        x: event.clientX - rectLeft,
        y: event.clientY - rectTop,
      };
      setDragEndDisplay(endDisplay);

      // コンテンツ座標に変換（スクロール補正を加味）
      const startContentX = dragStartDisplay.x + startScroll.left - laneOffset;
      const endContentX = endDisplay.x + scrollLeft - laneOffset;

      const leftX = Math.max(0, Math.min(startContentX, endContentX));
      const rightX = Math.max(startContentX, endContentX);

      const startContentY = dragStartDisplay.y + startScroll.top;
      const endContentY = endDisplay.y + scrollTop;
      const topY = Math.max(0, Math.min(startContentY, endContentY));
      const bottomY = Math.max(startContentY, endContentY);

      const startTime = positionToTime(leftX);
      const endTime = positionToTime(rightX);
      const leftTime = Math.min(startTime, endTime);
      const rightTime = Math.max(startTime, endTime);

      const selectedIds = timeline
        .map((item) => {
          const { top, bottom } = getLaneBounds(item.actionName);
          const overlapX = Math.max(leftTime, item.startTime) <= Math.min(rightTime, item.endTime);
          const overlapY = Math.max(topY, top) <= Math.min(bottomY, bottom);
          return overlapX && overlapY ? item.id : null;
        })
        .filter((id): id is string => Boolean(id));

      const finalIds = isAdditive
        ? Array.from(new Set([...baseSelection, ...selectedIds]))
        : selectedIds;

      onSelectionChange(finalIds);

      clearSelectionBox();
    },
    [
      dragEndDisplay,
      dragStartDisplay,
      onSelectionChange,
      isAdditive,
      baseSelection,
      startScroll.top,
      startScroll.left,
      getSelectionMetrics,
      clearSelectionBox,
      timeline,
      getLaneBounds,
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
