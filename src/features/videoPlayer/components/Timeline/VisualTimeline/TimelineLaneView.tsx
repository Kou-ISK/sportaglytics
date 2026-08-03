import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { TimelineLaneItem } from './TimelineLaneItem';
import type { TimelineLaneViewProps } from './TimelineLane.types';

export const TimelineLaneView: React.FC<TimelineLaneViewProps> = ({
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
  onEditRow,
  onRowClick,
  onRowContextMenu,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  timeToPosition,
  currentTimePosition,
  formatTime,
  maxSec,
  contentWidth,
  zoomScale,
  containerRef,
  isDraggingPlayhead,
  isEditModifierPressed,
  isTeam1,
  laneLabelColor,
  draftRange,
  onLaneDragOver,
  onLaneDrop,
  onPlayheadMouseDown,
  onEdgeMouseDown,
}) => {
  const theme = useTheme();

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
        component="button"
        type="button"
        draggable
        aria-pressed={isRowSelected}
        data-testid={`timeline-row-header-${rowId}`}
        onClick={(event) => onRowClick(event, rowId)}
        onDoubleClick={onEditRow}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onEditRow?.();
        }}
        onContextMenu={(event) => onRowContextMenu(event, rowId)}
        onDragStart={(event) => onRowDragStart(event, rowId)}
        onDragOver={onRowDragOver}
        onDrop={(event) => onRowDrop(event, rowId)}
        aria-label={`${actionName} 行`}
        variant="caption"
        sx={{
          color: laneLabelColor,
          fontWeight: 'bold',
          fontSize: '0.7rem',
          width: 120,
          flexShrink: 0,
          textAlign: 'right',
          userSelect: 'none',
          lineHeight: 1.1,
          position: 'sticky',
          left: 0,
          zIndex: 12,
          alignSelf: 'stretch',
          border: 0,
          borderRight: 1,
          borderColor: 'divider',
          backgroundColor: isRowSelected
            ? alpha(theme.palette.primary.main, 0.18)
            : 'background.paper',
          boxShadow: isRowSelected
            ? `inset 3px 0 0 ${theme.palette.primary.main}`
            : 'none',
          cursor: 'grab',
          px: 1,
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        {actionName}
      </Typography>

      <Box
        ref={containerRef}
        data-testid={`timeline-lane-${actionName}`}
        sx={{
          position: 'relative',
          height: 26,
          flex: 1,
          flexShrink: 0,
          backgroundColor: alpha(rowColor, 0.16),
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
        onDragOver={onLaneDragOver}
        onDrop={onLaneDrop}
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
            onEdgeMouseDown={onEdgeMouseDown}
            timeToPosition={timeToPosition}
            formatTime={formatTime}
            maxSec={maxSec}
            contentWidth={contentWidth}
            zoomScale={zoomScale}
            isTeam1={isTeam1}
            rowColor={rowColor}
            isEditModifierPressed={isEditModifierPressed}
          />
        ))}

        {draftRange && (
          <Box
            data-testid="timeline-create-preview"
            sx={{
              position: 'absolute',
              left: `${timeToPosition(draftRange.startTime)}px`,
              width: `${Math.max(
                2,
                timeToPosition(draftRange.endTime) -
                  timeToPosition(draftRange.startTime),
              )}px`,
              top: 1,
              bottom: 1,
              bgcolor: alpha(rowColor, 0.72),
              border: `1px dashed ${rowColor}`,
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 9,
            }}
          />
        )}

        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            left: `${currentTimePosition}px`,
            top: 0,
            bottom: 0,
            width: 2,
            transform: 'translateX(-1px)',
            backgroundColor: 'error.main',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />

        <Box
          onMouseDown={onPlayheadMouseDown}
          data-testid={`timeline-playhead-${actionName}`}
          sx={{
            position: 'absolute',
            left: `${currentTimePosition}px`,
            top: 0,
            bottom: 0,
            width: 12,
            transform: 'translateX(-6px)',
            backgroundColor: 'transparent',
            zIndex: isEditModifierPressed || isDraggingPlayhead ? 11 : 1,
            cursor: isEditModifierPressed
              ? 'col-resize'
              : isDraggingPlayhead
                ? 'grabbing'
                : 'grab',
          }}
        />
      </Box>
    </Box>
  );
};
