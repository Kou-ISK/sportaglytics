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
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  currentTimePosition: number;
  formatTime: (seconds: number) => string;
  firstTeamName: string | undefined;
  onSeek: (time: number) => void;
  maxSec: number;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
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
  timeToPosition,
  positionToTime: positionToTimeFromParent,
  currentTimePosition,
  formatTime,
  firstTeamName,
  onSeek,
  maxSec,
  onUpdateTimeRange,
}) => {
  const theme = useTheme();
  const teamName = actionName.split(' ')[0];
  const isTeam1 = teamName === firstTeamName;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

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
        gap: 1,
        position: 'relative',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: isTeam1 ? 'team1.main' : 'team2.main',
          fontWeight: 'bold',
          fontSize: '0.7rem',
          width: 120,
          flexShrink: 0,
          textAlign: 'right',
          pr: 1,
          userSelect: 'none',
        }}
      >
        {actionName}
      </Typography>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          height: 32,
          flex: 1,
          backgroundColor: theme.custom.rails.laneBg,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          userSelect: 'none',
        }}
      >
        {items.map((item) => {
          const left = timeToPosition(item.startTime);
          const width = Math.max(2, timeToPosition(item.endTime) - left);
          const isSelected = selectedIds.includes(item.id);
          const isHovered = hoveredItemId === item.id;
          const isFocused = focusedItemId === item.id;

          // バー背景色の決定
          let barBgColor: string;
          if (isSelected) {
            barBgColor = theme.palette.secondary.main;
          } else if (isTeam1) {
            barBgColor = theme.custom.bars.team1;
          } else {
            barBgColor = theme.custom.bars.team2;
          }

          let barOpacity = 0.7;
          if (isHovered) {
            barOpacity = 1;
          } else if (isSelected) {
            barOpacity = 0.9;
          }

          let borderColor = 'transparent';
          if (isFocused) {
            borderColor = theme.palette.primary.main;
          } else if (isSelected) {
            borderColor = theme.custom.bars.selectedBorder;
          }

          return (
            <Tooltip
              key={item.id}
              title={
                <Stack spacing={0.5}>
                  <Typography variant="caption">{item.actionName}</Typography>
                  <Typography variant="caption">
                    {formatTime(item.startTime)} - {formatTime(item.endTime)}
                  </Typography>
                  {item.actionType && (
                    <Typography variant="caption">
                      種別: {item.actionType}
                    </Typography>
                  )}
                  {item.actionResult && (
                    <Typography variant="caption">
                      結果: {item.actionResult}
                    </Typography>
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
                onMouseEnter={() => onHoverChange(item.id)}
                onMouseLeave={() => onHoverChange(null)}
                sx={{
                  position: 'absolute',
                  left: `${left}px`,
                  width: `${width}px`,
                  top: 4,
                  bottom: 4,
                  backgroundColor: barBgColor,
                  opacity: barOpacity,
                  borderRadius: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                  border: isSelected || isFocused ? 2 : 0,
                  borderColor,
                  outline: isFocused
                    ? `2px solid ${theme.palette.primary.main}`
                    : 'none',
                  outlineOffset: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scaleY(1.2)',
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

                {/* 中央テキスト */}
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
                  {formatTime(item.startTime)}
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
