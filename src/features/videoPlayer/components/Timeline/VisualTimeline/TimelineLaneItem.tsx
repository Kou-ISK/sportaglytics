import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TimelineData } from '../../../../../types/timeline/core';

const MIN_INSTANCE_HIT_WIDTH_PX = 10;
const EDGE_HIT_WIDTH_PX = 8;

interface TimelineLaneItemProps {
  item: TimelineData;
  actionName: string;
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  onHoverChange: (id: string | null) => void;
  onItemClick: (event: React.MouseEvent, id: string) => void;
  onItemContextMenu: (event: React.MouseEvent, id: string) => void;
  onMoveItem?: (
    ids: string[],
    targetActionName: string,
    operation: 'move' | 'copy',
  ) => void;
  onEdgeMouseDown: (
    event: React.MouseEvent,
    item: TimelineData,
    edge: 'start' | 'end',
  ) => void;
  timeToPosition: (time: number) => number;
  formatTime: (seconds: number) => string;
  isTeam1: boolean;
  rowColor: string;
  isEditModifierPressed: boolean;
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
  isTeam1,
  rowColor,
  isEditModifierPressed,
}) => {
  const theme = useTheme();
  const left = timeToPosition(item.startTime);
  const right = timeToPosition(item.endTime);
  const width = Math.max(0, right - left);
  const hitWidth = Math.max(width, MIN_INSTANCE_HIT_WIDTH_PX);
  const hitOffset = (width - hitWidth) / 2;
  const isSelected = selectedIds.includes(item.id);
  const isHovered = hoveredItemId === item.id;
  const isFocused = focusedItemId === item.id;

  const barBgColor = item.color ?? rowColor;
  void isTeam1;

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
          {item.labels?.map((label) => (
            <Typography
              key={`${label.group}-${label.name}`}
              variant="caption"
            >
              {label.group}: {label.name}
            </Typography>
          ))}
          {item.memo && (
            <Typography variant="caption">備考: {item.memo}</Typography>
          )}
        </Stack>
      }
    >
      <Box
        data-testid={`timeline-instance-${item.id}`}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={(event) => onItemClick(event, item.id)}
        onContextMenu={(event) => onItemContextMenu(event, item.id)}
        draggable={Boolean(onMoveItem) && !isEditModifierPressed}
        onDragStart={(event) => {
          if (!onMoveItem) return;
          const dragIds = selectedIds.includes(item.id) ? selectedIds : [item.id];
          event.dataTransfer.setData(
            'text/timeline-ids',
            JSON.stringify(dragIds),
          );
          event.dataTransfer.effectAllowed = 'copyMove';
        }}
        onDragOver={(event) => {
          if (!onMoveItem) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
        }}
        onDrop={(event) => {
          if (!onMoveItem) return;
          event.preventDefault();
          const data = event.dataTransfer.getData('text/timeline-ids');
          const parsed: unknown = data ? JSON.parse(data) : [];
          const ids = Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string')
            : [];
          if (ids.length > 0) {
            onMoveItem(ids, actionName, event.altKey ? 'copy' : 'move');
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
          boxSizing: 'border-box',
          overflow: 'visible',
          backgroundColor: barBgColor,
          opacity: barOpacity,
          filter: isSelected ? 'brightness(0.86)' : 'none',
          borderRadius: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: width >= 8 ? 0.5 : 0,
          border: isSelected || isFocused ? 3 : 1,
          borderColor,
          boxShadow: isSelected
            ? `0 0 0 3px ${theme.palette.secondary.main}33, 0 4px 12px ${theme.palette.secondary.main}55`
            : 'none',
          outline: isFocused
            ? `2px solid ${theme.palette.primary.main}`
            : 'none',
          outlineOffset: 2,
          zIndex: 2,
          transition: 'opacity 0.2s, filter 0.2s, transform 0.2s',
          '&:hover': {
            transform: 'scaleY(1.1)',
            zIndex: 5,
          },
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            left: hitOffset,
            width: hitWidth,
            top: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 1,
          }}
        />

        <Box
          onMouseDown={(event) => onEdgeMouseDown(event, item, 'start')}
          aria-label="開始位置を調整"
          sx={{
            position: 'absolute',
            left: -EDGE_HIT_WIDTH_PX / 2,
            top: 0,
            bottom: 0,
            width: EDGE_HIT_WIDTH_PX,
            cursor: isEditModifierPressed ? 'ew-resize' : 'pointer',
            zIndex: 15,
            '&:hover': {
              backgroundColor: isEditModifierPressed
                ? 'rgba(255,255,255,0.3)'
                : 'transparent',
            },
          }}
        />

        {width >= 16 && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {labelText ||
              `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`}
          </Typography>
        )}

        <Box
          onMouseDown={(event) => onEdgeMouseDown(event, item, 'end')}
          aria-label="終了位置を調整"
          sx={{
            position: 'absolute',
            right: -EDGE_HIT_WIDTH_PX / 2,
            top: 0,
            bottom: 0,
            width: EDGE_HIT_WIDTH_PX,
            cursor: isEditModifierPressed ? 'ew-resize' : 'pointer',
            zIndex: 15,
            '&:hover': {
              backgroundColor: isEditModifierPressed
                ? 'rgba(255,255,255,0.3)'
                : 'transparent',
            },
          }}
        />
      </Box>
    </Tooltip>
  );
};
