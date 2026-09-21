import React, { useRef } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { getContrastRatio, useTheme } from '@mui/material/styles';
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
  onEditItem?: (id: string) => void;
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
  onEditItem,
  onMoveItem,
  onEdgeMouseDown,
  timeToPosition,
  formatTime,
  isTeam1,
  rowColor,
  isEditModifierPressed,
}) => {
  const theme = useTheme();
  const suppressEdgeClick = useRef(false);
  const beginEdge = (event: React.MouseEvent, edge: 'start' | 'end'): void => {
    suppressEdgeClick.current =
      event.button === 0 && event.altKey && (event.metaKey || event.ctrlKey);
    onEdgeMouseDown(event, item, edge);
  };
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

  const labelColor =
    getContrastRatio(barBgColor, theme.palette.common.black) >= 4.5
      ? theme.palette.common.black
      : theme.palette.common.white;

  const borderColor = isFocused
    ? theme.palette.primary.main
    : isSelected
      ? theme.palette.primary.main
      : 'transparent';

  const labelText =
    item.labels && item.labels.length > 0
      ? item.labels.map((label) => label.name).join(', ')
      : '';

  return (
    <Tooltip
      disableInteractive
      title={
        <Stack spacing={0.5}>
          <Typography variant="caption">{item.actionName}</Typography>
          <Typography variant="caption">
            {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </Typography>
          {item.labels?.map((label) => (
            <Typography key={`${label.group}-${label.name}`} variant="caption">
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
        data-timeline-item-id={item.id}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onMouseDownCapture={() => {
          suppressEdgeClick.current = false;
        }}
        onClick={(event) => {
          // A modified edge drag edits its target without toggling selection.
          if (
            suppressEdgeClick.current ||
            (event.altKey && (event.metaKey || event.ctrlKey))
          ) {
            suppressEdgeClick.current = false;
            event.stopPropagation();
            return;
          }
          onItemClick(event, item.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEditItem?.(item.id);
        }}
        onContextMenu={(event) => onItemContextMenu(event, item.id)}
        draggable={Boolean(onMoveItem) && !isEditModifierPressed}
        onDragStart={(event) => {
          if (!onMoveItem) return;
          const dragIds = selectedIds.includes(item.id)
            ? selectedIds
            : [item.id];
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
            ? parsed.filter(
                (value): value is string => typeof value === 'string',
              )
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
          borderRadius: 0.5,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: width >= 8 ? 0.5 : 0,
          border: isSelected || isFocused ? 3 : 1,
          borderColor,
          outline:
            isFocused || isHovered
              ? `2px solid ${theme.palette.primary.main}`
              : 'none',
          outlineOffset: 2,
          zIndex: theme.custom.zIndex.timelineItem,
          transition: theme.custom.motion.transitionInteractive,
          '&:hover': {
            outline: `1px solid ${theme.palette.primary.main}`,
            zIndex: theme.custom.zIndex.timelineItem,
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
            zIndex: theme.custom.zIndex.timelineItem,
          }}
        />

        <Box
          onMouseDown={(event) => beginEdge(event, 'start')}
          aria-label="開始位置を調整"
          sx={{
            position: 'absolute',
            left: -EDGE_HIT_WIDTH_PX / 2,
            top: 0,
            bottom: 0,
            width: EDGE_HIT_WIDTH_PX,
            cursor: isEditModifierPressed ? 'ew-resize' : 'pointer',
            zIndex: theme.custom.zIndex.timelinePlayhead,
            '&:hover': {
              backgroundColor: isEditModifierPressed
                ? theme.custom.tokens.surface.hover
                : 'transparent',
            },
          }}
        />

        {width >= 16 && (
          <Typography
            variant="caption"
            sx={{
              color: labelColor,
              fontSize: theme.custom.typography.labelCompact.fontSize,
              fontFamily: labelText
                ? 'inherit'
                : theme.custom.typography.fontFamilyMono,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
              zIndex: theme.custom.zIndex.timelineItem,
            }}
          >
            {labelText ||
              `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`}
          </Typography>
        )}

        <Box
          onMouseDown={(event) => beginEdge(event, 'end')}
          aria-label="終了位置を調整"
          sx={{
            position: 'absolute',
            right: -EDGE_HIT_WIDTH_PX / 2,
            top: 0,
            bottom: 0,
            width: EDGE_HIT_WIDTH_PX,
            cursor: isEditModifierPressed ? 'ew-resize' : 'pointer',
            zIndex: theme.custom.zIndex.timelinePlayhead,
            '&:hover': {
              backgroundColor: isEditModifierPressed
                ? theme.custom.tokens.surface.hover
                : 'transparent',
            },
          }}
        />
      </Box>
    </Tooltip>
  );
};
