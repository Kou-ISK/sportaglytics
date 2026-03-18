import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TimelineLaneItem } from './TimelineLaneItem';
import type { TimelineLaneViewProps } from './TimelineLane.types';

export const TimelineLaneView: React.FC<TimelineLaneViewProps> = ({
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
  currentTimePosition,
  formatTime,
  maxSec,
  contentWidth,
  zoomScale,
  containerRef,
  isDraggingPlayhead,
  isAltKeyPressed,
  isTeam1,
  laneLabelColor,
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
            isAltKeyPressed={isAltKeyPressed}
          />
        ))}

        <Box
          onMouseDown={onPlayheadMouseDown}
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
