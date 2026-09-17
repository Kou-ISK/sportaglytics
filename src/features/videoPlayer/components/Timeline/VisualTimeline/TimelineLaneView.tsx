import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { TimelineLaneItem } from './TimelineLaneItem';
import type { TimelineLaneViewProps } from './TimelineLane.types';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from './domain/timelineCoordinateMapper';

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
  onEditItem,
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
  contentWidth,
  zoomScale,
  containerRef,
  isEditModifierPressed,
  isTeam1,
  draftRange,
  onLaneDragOver,
  onLaneDrop,
  onRangeCreateMouseDown,
  onCreateItem,
  onEdgeMouseDown,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        position: 'relative',
        height: 32,
        minHeight: 32,
        borderBottom: 1,
        borderColor: 'divider',
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
        title={actionName}
        variant="caption"
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          fontSize: '0.75rem',
          width: TIMELINE_ROW_HEADER_WIDTH_PX,
          flexShrink: 0,
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
          lineHeight: 1.1,
          position: 'sticky',
          left: 0,
          zIndex: theme.custom.zIndex.timelineRowHeader,
          alignSelf: 'stretch',
          border: 0,
          borderRight: 1,
          borderColor: 'divider',
          borderLeft: `3px solid ${rowColor}`,
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
          height: '100%',
          flex: 1,
          flexShrink: 0,
          backgroundColor: alpha(rowColor, 0.06),
          borderRadius: 0,
          border: 0,
          borderColor: 'divider',
          boxSizing: 'border-box',
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
          overflow: 'visible',
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
            onEditItem={onEditItem}
            onMoveItem={onMoveItem}
            onEdgeMouseDown={onEdgeMouseDown}
            timeToPosition={timeToPosition}
            formatTime={formatTime}
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
                0,
                timeToPosition(draftRange.endTime) -
                  timeToPosition(draftRange.startTime),
              )}px`,
              top: 1,
              bottom: 1,
              boxSizing: 'border-box',
              bgcolor: alpha(rowColor, 0.72),
              border: `1px dashed ${rowColor}`,
              borderRadius: 0.5,
              pointerEvents: 'none',
              zIndex: theme.custom.zIndex.timelineSelection,
            }}
          />
        )}

        <Box
          onMouseDown={onRangeCreateMouseDown}
          onClick={(event) => event.stopPropagation()}
          data-testid={`timeline-playhead-${actionName}`}
          sx={{
            position: 'absolute',
            left: `${currentTimePosition}px`,
            top: 0,
            bottom: 0,
            width: 12,
            transform: 'translateX(-6px)',
            backgroundColor: 'transparent',
            pointerEvents:
              isEditModifierPressed && onCreateItem ? 'auto' : 'none',
            // インスタンスのstacking contextより下に置き、赤線と端が重なっても端の編集を優先する。
            zIndex: theme.custom.zIndex.workSurface,
            cursor: 'col-resize',
          }}
        />
      </Box>
    </Box>
  );
};
