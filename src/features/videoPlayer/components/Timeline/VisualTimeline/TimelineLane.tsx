import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TimelineData } from '../../../../../types/TimelineData';

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
        {items.map((item) => {
          const totalWidth =
            contentWidth !== undefined
              ? contentWidth * zoomScale
              : Math.max(timeToPosition(maxSec), 0);
          const left = Math.max(
            0,
            Math.min(timeToPosition(item.startTime), totalWidth),
          );
          const right = Math.max(
            0,
            Math.min(timeToPosition(item.endTime), totalWidth),
          );
          const width = Math.max(4, right - left);
          const isSelected = selectedIds.includes(item.id);
          const isHovered = hoveredItemId === item.id;
          const isFocused = focusedItemId === item.id;

          // バー背景色の決定（item.colorがあればそれを使用、なければチーム色）
          const barBgColor = item.color
            ? item.color
            : isTeam1
              ? theme.custom.bars.team1
              : theme.custom.bars.team2;

          let barOpacity = 0.7;
          if (isHovered) {
            barOpacity = 1;
          } else if (isSelected) {
            barOpacity = 0.9;
          }

          const borderColor = isFocused
            ? theme.palette.primary.main
            : isSelected
              ? theme.custom.bars.selectedBorder
              : 'transparent';

          const labelText =
            item.labels && item.labels.length > 0
              ? item.labels.map((l) => l.name).join(', ')
              : '';

          return (
            <Tooltip
              key={item.id}
              title={
                <Stack spacing={0.5}>
                  <Typography variant="caption">{item.actionName}</Typography>
                  <Typography variant="caption">
                    {formatTime(item.startTime)} - {formatTime(item.endTime)}
                  </Typography>
                  {item.labels && item.labels.length > 0 && (
                    <>
                      {item.labels.map((label) => (
                        <Typography
                          key={`${label.group}-${label.name}`}
                          variant="caption"
                        >
                          {label.group}: {label.name}
                        </Typography>
                      ))}
                    </>
                  )}
                  {item.qualifier && (
                    <Typography variant="caption">
                      備考: {item.qualifier}
                    </Typography>
                  )}
                </Stack>
              }
            >
              <Box
                onClick={(event) => onItemClick(event, item.id)}
                onContextMenu={(event) => onItemContextMenu(event, item.id)}
                draggable={Boolean(onMoveItem)}
                onDragStart={(event) => {
                  if (!onMoveItem) return;
                  const dragIds = selectedIds.includes(item.id)
                    ? selectedIds
                    : [item.id];
                  event.dataTransfer.setData(
                    'text/timeline-ids',
                    JSON.stringify(dragIds),
                  );
                  event.dataTransfer.effectAllowed = 'move';
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
                  const data = event.dataTransfer.getData('text/timeline-ids');
                  const ids: string[] = data ? JSON.parse(data) : [];
                  if (ids.length > 0) {
                    onMoveItem(ids, actionName);
                  }
                }}
                onMouseEnter={() => onHoverChange(item.id)}
                onMouseLeave={() => onHoverChange(null)}
                sx={{
                  position: 'absolute',
                  left: `${left}px`,
                  width: `${width}px`,
                  top: 1,
                  bottom: 1,
                  backgroundColor: barBgColor,
                  opacity: barOpacity,
                  filter: isSelected ? 'brightness(0.86)' : 'none',
                  borderRadius: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                  border: isSelected || isFocused ? 3 : 1,
                  borderColor,
                  boxShadow: isSelected
                    ? `0 0 0 3px ${theme.palette.secondary.main}33, 0 4px 12px ${theme.palette.secondary.main}55`
                    : 'none',
                  outline: isFocused
                    ? `2px solid ${theme.palette.primary.main}`
                    : 'none',
                  outlineOffset: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scaleY(1.1)',
                    zIndex: 5,
                  },
                }}
              >
                {/* 左エッジ（開始時刻調整） */}
                <Box
                  onMouseDown={(e) => handleEdgeMouseDown(e, item, 'start')}
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: isAltKeyPressed ? 'ew-resize' : 'pointer',
                    zIndex: 15,
                    '&:hover': {
                      backgroundColor: isAltKeyPressed
                        ? 'rgba(255,255,255,0.3)'
                        : 'transparent',
                    },
                  }}
                />

                {/* 中央テキスト: ラベル優先で表示、なければ時間 */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {labelText ||
                    `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`}
                </Typography>

                {/* 右エッジ（終了時刻調整） */}
                <Box
                  onMouseDown={(e) => handleEdgeMouseDown(e, item, 'end')}
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: isAltKeyPressed ? 'ew-resize' : 'pointer',
                    zIndex: 15,
                    '&:hover': {
                      backgroundColor: isAltKeyPressed
                        ? 'rgba(255,255,255,0.3)'
                        : 'transparent',
                    },
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}

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
