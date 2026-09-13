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
  maxSec,
  onUpdateTimeRange,
  contentWidth,
  zoomScale,
}: TimelineLaneProps): TimelineLaneViewProps => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDragCleanupRef = useRef<(() => void) | null>(null);
  const [isEditModifierPressed, setIsEditModifierPressed] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState<{
    original: TimelineData;
    startTime: number;
    endTime: number;
  } | null>(null);
  const [draftRange, setDraftRange] = useState<{
    startTime: number;
    endTime: number;
  } | null>(null);

  useEffect(() => {
    laneRef?.(containerRef.current);
  }, [laneRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      setIsEditModifierPressed(
        event.altKey && (event.metaKey || event.ctrlKey),
      );
      if (event.key === 'Escape' && activeDragCleanupRef.current) {
        event.preventDefault();
        event.stopPropagation();
        activeDragCleanupRef.current();
      }
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const modifierStillPressed =
        event.altKey && (event.metaKey || event.ctrlKey);
      setIsEditModifierPressed(modifierStillPressed);
      if (!modifierStillPressed) activeDragCleanupRef.current?.();
    };
    const handleBlur = (): void => {
      setIsEditModifierPressed(false);
      activeDragCleanupRef.current?.();
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);
    globalThis.addEventListener('blur', handleBlur);

    return () => {
      activeDragCleanupRef.current?.();
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
      globalThis.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!edgeDraft) return;
    const current = items.find((item) => item.id === edgeDraft.original.id);
    if (
      !current ||
      !selectedIds.includes(current.id) ||
      current.startTime !== edgeDraft.original.startTime ||
      current.endTime !== edgeDraft.original.endTime
    ) {
      activeDragCleanupRef.current?.();
    }
  }, [edgeDraft, items, selectedIds]);

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
        event.button !== 0 ||
        !event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        !selectedIds.includes(item.id) ||
        !onUpdateTimeRange
      ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      activeDragCleanupRef.current?.();

      let startTime = item.startTime;
      let endTime = item.endTime;
      setEdgeDraft({ original: item, startTime, endTime });
      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        const newTime = positionToTime(clientXToContentX(mouseEvent.clientX));
        if (edge === 'start') {
          startTime = Math.max(
            0,
            Math.min(
              newTime,
              item.endTime - MIN_TIMELINE_INSTANCE_DURATION_SECONDS,
            ),
          );
        } else {
          endTime = Math.min(
            maxSec,
            Math.max(
              newTime,
              item.startTime + MIN_TIMELINE_INSTANCE_DURATION_SECONDS,
            ),
          );
        }
        setEdgeDraft({ original: item, startTime, endTime });
      };
      const cleanup = (): void => {
        setEdgeDraft(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', finish);
        if (activeDragCleanupRef.current === cleanup) {
          activeDragCleanupRef.current = null;
        }
      };
      const finish = (): void => {
        cleanup();
        // 1 gesture = 1 persistence update / Undo entry. Preview stays local.
        if (startTime !== item.startTime || endTime !== item.endTime) {
          onUpdateTimeRange(item.id, startTime, endTime);
        }
      };
      activeDragCleanupRef.current = cleanup;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', finish);
    },
    [clientXToContentX, maxSec, onUpdateTimeRange, positionToTime, selectedIds],
  );

  const handleRangeCreateMouseDown = useCallback(
    (event: React.MouseEvent): void => {
      if (
        event.button !== 0 ||
        !event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        !onCreateItem
      )
        return;
      event.stopPropagation();
      event.preventDefault();
      activeDragCleanupRef.current?.();
      const anchorTime = positionToTime(currentTimePosition);
      setDraftRange({ startTime: anchorTime, endTime: anchorTime });
      let lastTime = anchorTime;

      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        lastTime = positionToTime(clientXToContentX(mouseEvent.clientX));
        setDraftRange({
          startTime: Math.min(anchorTime, lastTime),
          endTime: Math.max(anchorTime, lastTime),
        });
      };
      const cleanup = (): void => {
        setDraftRange(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (activeDragCleanupRef.current === cleanup)
          activeDragCleanupRef.current = null;
      };
      const handleMouseUp = (): void => {
        if (
          Math.abs(lastTime - anchorTime) >=
          MIN_TIMELINE_INSTANCE_DURATION_SECONDS
        ) {
          onCreateItem(
            actionName,
            Math.min(anchorTime, lastTime),
            Math.max(anchorTime, lastTime),
            rowColor,
          );
        }
        cleanup();
      };
      activeDragCleanupRef.current = cleanup;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [
      actionName,
      clientXToContentX,
      currentTimePosition,
      onCreateItem,
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
    items: items.map((item) =>
      item.id === edgeDraft?.original.id
        ? {
            ...item,
            startTime: edgeDraft.startTime,
            endTime: edgeDraft.endTime,
          }
        : item,
    ),
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
    maxSec,
    onUpdateTimeRange,
    contentWidth,
    zoomScale,
    containerRef,
    isEditModifierPressed,
    isTeam1,
    laneLabelColor,
    draftRange,
    onLaneDragOver: handleLaneDragOver,
    onLaneDrop: handleLaneDrop,
    onRangeCreateMouseDown: handleRangeCreateMouseDown,
    onEdgeMouseDown: handleEdgeMouseDown,
  };
};
