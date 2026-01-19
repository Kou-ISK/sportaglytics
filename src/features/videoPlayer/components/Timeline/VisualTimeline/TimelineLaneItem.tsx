import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TimelineData } from '../../../../../types/TimelineData';

interface TimelineLaneItemProps {
  item: TimelineData;
  actionName: string;
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  onHoverChange: (id: string | null) => void;
  onItemClick: (event: React.MouseEvent, id: string) => void;
  onItemContextMenu: (event: React.MouseEvent, id: string) => void;
  onMoveItem?: (ids: string[], targetActionName: string) => void;
  onEdgeMouseDown: (
    event: React.MouseEvent,
    item: TimelineData,
    edge: 'start' | 'end',
  ) => void;
  timeToPosition: (time: number) => number;
  formatTime: (seconds: number) => string;
  maxSec: number;
  contentWidth?: number;
  zoomScale: number;
  isTeam1: boolean;
  isAltKeyPressed: boolean;
}

export const TimelineLaneItem: React.FC<TimelineLaneItemProps> = ({
  item,
  actionName,
  selectedIds,
  hoveredItemId,
  focusedItemId,
  onHoverChange,
  onItemClick,
  onItemContextMenu,
  onMoveItem,
  onEdgeMouseDown,
  timeToPosition,
  formatTime,
  maxSec,
  contentWidth,
  zoomScale,
  isTeam1,
  isAltKeyPressed,
}) => {
  const theme = useTheme();
  const totalWidth =
    contentWidth !== undefined
      ? contentWidth * zoomScale
      : Math.max(timeToPosition(maxSec), 0);
  const left = Math.max(0, Math.min(timeToPosition(item.startTime), totalWidth));
  const right = Math.max(0, Math.min(timeToPosition(item.endTime), totalWidth));
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
      ? item.labels.map((label) => label.name).join(', ')
      : '';

  return (
    <Tooltip
      title={
        <Stack spacing={0.5}>
          <Typography variant="caption">{item.actionName}</Typography>
          <Typography variant="caption">
            {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </Typography>
          {item.labels && item.labels.length > 0 && (
            <>
              {item.labels.map((label) => (
                <Typography key={`${label.group}-${label.name}`} variant="caption">
                  {label.group}: {label.name}
                </Typography>
              ))}
            </>
          )}
          {item.memo && (
            <Typography variant="caption">備考: {item.memo}</Typography>
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
          const dragIds = selectedIds.includes(item.id) ? selectedIds : [item.id];
          event.dataTransfer.setData('text/timeline-ids', JSON.stringify(dragIds));
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
          outline: isFocused ? `2px solid ${theme.palette.primary.main}` : 'none',
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
          onMouseDown={(event) => onEdgeMouseDown(event, item, 'start')}
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
          onMouseDown={(event) => onEdgeMouseDown(event, item, 'end')}
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
};
