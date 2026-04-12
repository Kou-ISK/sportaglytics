import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type {
  TimelineLaneProps,
  TimelineLaneViewProps,
} from '../TimelineLane.types';

const parseTimelineDragIds = (rawIds: string): string[] => {
  if (!rawIds) {
    return [];
  }

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
  actionName,
  items,
  selectedIds,
  hoveredItemId,
  focusedItemId,
  onHoverChange,
  onItemClick,
  onItemContextMenu,
  onMoveItem,
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
}: TimelineLaneProps): TimelineLaneViewProps => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  useEffect(() => {
    laneRef?.(containerRef.current);
  }, [laneRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey) {
        setIsAltKeyPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (!event.altKey) {
        setIsAltKeyPressed(false);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const teamName = actionName.split(' ')[0];
  const isTeam1 = teamName === firstTeamName;
  const laneLabelColor = useMemo(() => {
    if (items[0]?.color) {
      return items[0].color;
    }

    return isTeam1 ? 'team1.main' : 'team2.main';
  }, [isTeam1, items]);

  const handleEdgeMouseDown = useCallback(
    (
      event: React.MouseEvent,
      item: TimelineData,
      edge: 'start' | 'end',
    ): void => {
      if (!event.altKey) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        if (!containerRef.current || !onUpdateTimeRange) {
          return;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = mouseEvent.clientX - rect.left;
        const newTime = Math.max(0, Math.min(positionToTime(mouseX), maxSec));

        if (edge === 'start') {
          const adjustedStart = Math.min(newTime, item.endTime - 0.1);
          onUpdateTimeRange(item.id, adjustedStart, item.endTime);
          onSeek(adjustedStart);
          return;
        }

        const adjustedEnd = Math.max(newTime, item.startTime + 0.1);
        onUpdateTimeRange(item.id, item.startTime, adjustedEnd);
        onSeek(adjustedEnd);
      };

      const handleMouseUp = (): void => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [maxSec, onSeek, onUpdateTimeRange, positionToTime],
  );

  const handlePlayheadMouseDown = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation();
      setIsDraggingPlayhead(true);

      const handleMouseMove = (mouseEvent: MouseEvent): void => {
        if (!containerRef.current) {
          return;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = Math.max(
          0,
          Math.min(mouseEvent.clientX - rect.left, rect.width),
        );
        const time = (clickX / rect.width) * maxSec;
        onSeek(time);
      };

      const handleMouseUp = (): void => {
        setIsDraggingPlayhead(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [maxSec, onSeek],
  );

  const handleLaneDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!onMoveItem) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [onMoveItem],
  );

  const handleLaneDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!onMoveItem) {
        return;
      }

      event.preventDefault();
      const ids = parseTimelineDragIds(
        event.dataTransfer.getData('text/timeline-ids'),
      );
      if (ids.length > 0) {
        onMoveItem(ids, actionName);
      }
    },
    [actionName, onMoveItem],
  );

  return {
    actionName,
    items,
    selectedIds,
    hoveredItemId,
    focusedItemId,
    onHoverChange,
    onItemClick,
    onItemContextMenu,
    onMoveItem,
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
    isAltKeyPressed,
    isTeam1,
    laneLabelColor,
    onLaneDragOver: handleLaneDragOver,
    onLaneDrop: handleLaneDrop,
    onPlayheadMouseDown: handlePlayheadMouseDown,
    onEdgeMouseDown: handleEdgeMouseDown,
  };
};
