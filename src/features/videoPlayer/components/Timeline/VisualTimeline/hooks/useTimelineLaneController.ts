import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { MIN_TIMELINE_INSTANCE_DURATION_SECONDS } from '../domain/timelineCoordinateMapper';
import type {
  TimelineLaneProps,
  TimelineLaneViewProps,
} from '../TimelineLane.types';

const parseTimelineDragIds = (rawIds: string): string[] => {
  if (!rawIds) return [];

  try {
    const parsed = JSON.parse(rawIds) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

export const useTimelineLaneController = ({
  laneRef,
  rowId,
  actionName,
  rowColor,
  isRowSelected,
  items,
  selectedIds,
  hoveredItemId,
  focusedItemId,
  onHoverChange,
  onItemClick,
  onItemContextMenu,
  onMoveItem,
  onCreateItem,
  onEditRow,
  onRowClick,
  onRowContextMenu,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  timeToPosition,
  positionToTime,
  clientXToContentX,
  currentTimePosition,
  formatTime,
  firstTeamName,
  onSeek,
  maxSec,
  onUpdateTimeRange,
  contentWidth,
  zoomScale,
}: TimelineLaneProps): TimelineLaneViewProps => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeEdgeDragCleanupRef = useRef<(() => void) | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isEditModifierPressed, setIsEditModifierPressed] = useState(false);
  const [draftRange, setDraftRange] = useState<{
    startTime: number;
    endTime: number;
  } | null>(null);

  useEffect(() => {
    laneRef?.(containerRef.current);
  }, [laneRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      setIsEditModifierPressed(event.altKey && event.metaKey);
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const modifierStillPressed = event.altKey && event.metaKey;
      setIsEditModifierPressed(modifierStillPressed);
      if (!modifierStillPressed) activeEdgeDragCleanupRef.current?.();
    };
    const handleBlur = (): void => {
      setIsEditModifierPressed(false);
      activeEdgeDragCleanupRef.current?.();
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);
    globalThis.addEventListener('blur', handleBlur);

    return () => {
      activeEdgeDragCleanupRef.current?.();
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
      globalThis.removeEventListener('blur', handleBlur);
    };
  }, []);

  const teamName = actionName.split(' ')[0];
  const isTeam1 = teamName === firstTeamName;
  const laneLabelColor = useMemo(() => rowColor, [rowColor]);

  const handleEdgeMouseDown = useCallback(
    (
      event: React.MouseEvent,
      item: TimelineData,
      edge: 'start' | 'end',
    ): void => {
      if (
        !event.altKey ||
        !event.metaKey ||
        !selectedIds.includes(item.id) ||
        !onUpdateTimeRange
      ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      activeEdgeDragCleanupRef.current?.();

      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        const newTime = positionToTime(clientXToContentX(mouseEvent.clientX));

        if (edge === 'start') {
          const adjustedStart = Math.min(
            newTime,
            item.endTime - MIN_TIMELINE_INSTANCE_DURATION_SECONDS,
          );
          onUpdateTimeRange(item.id, Math.max(0, adjustedStart), item.endTime);
          onSeek(Math.max(0, adjustedStart));
          return;
        }

        const adjustedEnd = Math.max(
          newTime,
          item.startTime + MIN_TIMELINE_INSTANCE_DURATION_SECONDS,
        );
        const clampedEnd = Math.min(maxSec, adjustedEnd);
        onUpdateTimeRange(item.id, item.startTime, clampedEnd);
        onSeek(clampedEnd);
      };

      const cleanup = (): void => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', cleanup);
        if (activeEdgeDragCleanupRef.current === cleanup) {
          activeEdgeDragCleanupRef.current = null;
        }
      };

      activeEdgeDragCleanupRef.current = cleanup;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', cleanup);
    },
    [
      clientXToContentX,
      maxSec,
      onSeek,
      onUpdateTimeRange,
      positionToTime,
      selectedIds,
    ],
  );

  const handlePlayheadMouseDown = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation();
      setIsDraggingPlayhead(true);
      const isCreating = event.altKey && event.metaKey && Boolean(onCreateItem);
      const anchorTime = positionToTime(currentTimePosition);
      if (isCreating) {
        setDraftRange({ startTime: anchorTime, endTime: anchorTime });
      }

      let lastTime = anchorTime;

      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        const time = positionToTime(clientXToContentX(mouseEvent.clientX));
        lastTime = time;
        onSeek(time);
        if (isCreating) {
          setDraftRange({
            startTime: Math.min(anchorTime, time),
            endTime: Math.max(anchorTime, time),
          });
        }
      };

      const handleMouseUp = (): void => {
        setIsDraggingPlayhead(false);
        if (
          isCreating &&
          Math.abs(lastTime - anchorTime) >=
            MIN_TIMELINE_INSTANCE_DURATION_SECONDS
        ) {
          onCreateItem?.(
            actionName,
            Math.min(anchorTime, lastTime),
            Math.max(anchorTime, lastTime),
            rowColor,
          );
        }
        setDraftRange(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [
      actionName,
      clientXToContentX,
      currentTimePosition,
      onCreateItem,
      onSeek,
      positionToTime,
      rowColor,
    ],
  );

  const handleLaneDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!onMoveItem) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
    },
    [onMoveItem],
  );

  const handleLaneDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!onMoveItem) return;
      event.preventDefault();
      const ids = parseTimelineDragIds(
        event.dataTransfer.getData('text/timeline-ids'),
      );
      if (ids.length > 0) {
        onMoveItem(ids, actionName, event.altKey ? 'copy' : 'move');
      }
    },
    [actionName, onMoveItem],
  );

  return {
    rowId,
    actionName,
    rowColor,
    isRowSelected,
    items,
    selectedIds,
    hoveredItemId,
    focusedItemId,
    onHoverChange,
    onItemClick,
    onItemContextMenu,
    onMoveItem,
    onCreateItem,
    onEditRow,
    onRowClick,
    onRowContextMenu,
    onRowDragStart,
    onRowDragOver,
    onRowDrop,
    timeToPosition,
    positionToTime,
    currentTimePosition,
    formatTime,
    firstTeamName,
    onSeek,
    maxSec,
    onUpdateTimeRange,
    contentWidth,
    zoomScale,
    containerRef,
    isDraggingPlayhead,
    isEditModifierPressed,
    isTeam1,
    laneLabelColor,
    draftRange,
    onLaneDragOver: handleLaneDragOver,
    onLaneDrop: handleLaneDrop,
    onPlayheadMouseDown: handlePlayheadMouseDown,
    onEdgeMouseDown: handleEdgeMouseDown,
  };
};
