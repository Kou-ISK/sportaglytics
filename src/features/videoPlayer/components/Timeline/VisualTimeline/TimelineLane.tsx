import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TimelineData } from '../../../../../types/TimelineData';
import { TimelineLaneItem } from './TimelineLaneItem';

interface TimelineLaneProps {
  actionName: string;
  items: TimelineData[];
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  onHoverChange: (id: string | null) => void;
  onItemClick: (event: React.MouseEvent, id: string) => void;
  onItemContextMenu: (event: React.MouseEvent, id: string) => void;
  onMoveItem?: (ids: string[], targetActionName: string) => void;
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  currentTimePosition: number;
  formatTime: (seconds: number) => string;
  firstTeamName: string | undefined;
  onSeek: (time: number) => void;
  maxSec: number;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  laneRef?: (el: HTMLDivElement | null) => void;
  contentWidth?: number;
  zoomScale: number;
}

export const TimelineLane: React.FC<TimelineLaneProps> = ({
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
  positionToTime: positionToTimeFromParent,
  currentTimePosition,
  formatTime,
  firstTeamName,
  onSeek,
  maxSec,
  onUpdateTimeRange,
  laneRef,
  contentWidth,
  zoomScale,
}) => {
  const theme = useTheme();
  const teamName = actionName.split(' ')[0];
  const isTeam1 = teamName === firstTeamName;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  useEffect(() => {
    laneRef?.(containerRef.current);
  }, [laneRef]);

  // Alt/Optionキーの状態を監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setIsAltKeyPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
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

  const handleEdgeMouseDown = useCallback(
    (event: React.MouseEvent, item: TimelineData, edge: 'start' | 'end') => {
      // Option/Altキーが押されている場合のみエッジドラッグを開始
      if (!event.altKey) return;

      event.stopPropagation();
      event.preventDefault();

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || !onUpdateTimeRange) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const newTime = Math.max(
          0,
          Math.min(positionToTimeFromParent(mouseX), maxSec),
        );

        if (edge === 'start') {
          // 開始時刻を調整（終了時刻より前に限定）
          const adjustedStart = Math.min(newTime, item.endTime - 0.1);
          onUpdateTimeRange(item.id, adjustedStart, item.endTime);
          // シークバーと映像を追従
          onSeek(adjustedStart);
        } else {
          // 終了時刻を調整（開始時刻より後に限定）
          const adjustedEnd = Math.max(newTime, item.startTime + 0.1);
          onUpdateTimeRange(item.id, item.startTime, adjustedEnd);
          // シークバーと映像を追従
          onSeek(adjustedEnd);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [maxSec, onUpdateTimeRange, positionToTimeFromParent, onSeek],
  );

  const handlePlayheadMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsDraggingPlayhead(true);

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const time = (clickX / rect.width) * maxSec;
        onSeek(time);
      };

      const handleMouseUp = () => {
        setIsDraggingPlayhead(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [maxSec, onSeek],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        position: 'relative',
        minHeight: 32,
        width: '100%',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          // 行ラベルの色: 最初のアイテムに色があればそれを使用、なければチーム色
          color: items[0]?.color
            ? items[0].color
            : isTeam1
              ? 'team1.main'
              : 'team2.main',
          fontWeight: 'bold',
          fontSize: '0.7rem',
          width: 120,
          flexShrink: 0,
          textAlign: 'right',
          userSelect: 'none',
          lineHeight: 1.1,
        }}
      >
        {actionName}
      </Typography>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          height: 26,
          flex: 1,
          flexShrink: 0,
          backgroundColor: theme.custom.rails.laneBg,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          userSelect: 'none',
          mb: 0,
          width:
            contentWidth !== undefined
              ? `${contentWidth * zoomScale}px`
              : '100%',
          minWidth:
            contentWidth !== undefined
              ? `${contentWidth * zoomScale}px`
              : '100%',
          overflow: 'hidden',
        }}
        onDragOver={(event) => {
          if (onMoveItem) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(event) => {
          if (!onMoveItem) return;
          event.preventDefault();
          const rawIds = event.dataTransfer.getData('text/timeline-ids');
          const ids: string[] = rawIds ? JSON.parse(rawIds) : [];
          if (ids.length > 0) {
            onMoveItem(ids, actionName);
          }
        }}
      >
        {items.map((item) => (
          <TimelineLaneItem
            key={item.id}
            item={item}
            actionName={actionName}
            selectedIds={selectedIds}
            hoveredItemId={hoveredItemId}
            focusedItemId={focusedItemId}
            onHoverChange={onHoverChange}
            onItemClick={onItemClick}
            onItemContextMenu={onItemContextMenu}
            onMoveItem={onMoveItem}
            onEdgeMouseDown={handleEdgeMouseDown}
            timeToPosition={timeToPosition}
            formatTime={formatTime}
            maxSec={maxSec}
            contentWidth={contentWidth}
            zoomScale={zoomScale}
            isTeam1={isTeam1}
            isAltKeyPressed={isAltKeyPressed}
          />
        ))}

        <Box
          onMouseDown={handlePlayheadMouseDown}
          sx={{
            position: 'absolute',
            left: `${currentTimePosition}px`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: 'error.main',
            zIndex: 10,
            cursor: isDraggingPlayhead ? 'grabbing' : 'grab',
            '&:hover': {
              width: 4,
            },
          }}
        />
      </Box>
    </Box>
  );
};
