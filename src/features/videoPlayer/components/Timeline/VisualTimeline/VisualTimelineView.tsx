import React from 'react';
import { Box } from '@mui/material';
import type { TimelineData } from '../../../../../types/TimelineData';
import { TimelineAxis } from './TimelineAxis';
import { TimelineDialogs } from './TimelineDialogs';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineLane } from './TimelineLane';
import { TimelineSelectionOverlay } from './TimelineSelectionOverlay';
import { ZoomIndicator } from './ZoomIndicator';

export interface VisualTimelineViewProps {
  zoomScale: number;
  axisRef: React.RefObject<HTMLDivElement | null>;
  maxSec: number;
  currentTimePosition: number;
  containerWidth: number;
  timeMarkers: number[];
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  onSeek: (time: number) => void;
  formatTime: (seconds: number) => string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  actionNames: string[];
  groupedByAction: Record<string, TimelineData[]>;
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  handleItemClick: React.ComponentProps<typeof TimelineLane>['onItemClick'];
  handleItemContextMenu: (e: React.MouseEvent, id: string) => void;
  firstTeamName?: string;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  handleMoveItems: (ids: string[], targetActionName: string) => void;
  laneRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onBackgroundClick: (e: React.MouseEvent) => void;
  timeline: TimelineData[];
  isSelecting: boolean;
  selectionBox:
    | React.ComponentProps<typeof TimelineSelectionOverlay>['selectionBox']
    | null;
  dialogsProps: React.ComponentProps<typeof TimelineDialogs>;
}

export const VisualTimelineView = ({
  zoomScale,
  axisRef,
  maxSec,
  currentTimePosition,
  containerWidth,
  timeMarkers,
  timeToPosition,
  positionToTime,
  onSeek,
  formatTime,
  scrollContainerRef,
  containerRef,
  actionNames,
  groupedByAction,
  selectedIds,
  hoveredItemId,
  focusedItemId,
  setHoveredItemId,
  handleItemClick,
  handleItemContextMenu,
  firstTeamName,
  onUpdateTimeRange,
  handleMoveItems,
  laneRefs,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onBackgroundClick,
  timeline,
  isSelecting,
  selectionBox,
  dialogsProps,
}: VisualTimelineViewProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ZoomIndicator zoomScale={zoomScale} />
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backgroundColor: 'background.paper',
            px: 1.5,
            pt: 0,
            pb: 0,
            mb: 0,
            overflow: 'hidden',
          }}
        >
          <TimelineAxis
            axisRef={axisRef}
            maxSec={maxSec}
            currentTimePosition={currentTimePosition}
            contentWidth={containerWidth}
            zoomScale={zoomScale}
            timeMarkers={timeMarkers}
            timeToPosition={timeToPosition}
            positionToTime={positionToTime}
            onSeek={onSeek}
            formatTime={formatTime}
          />
        </Box>

        <Box
          ref={scrollContainerRef}
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            maxHeight: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            px: 1.5,
            pt: 0,
            pb: 3.5,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onClick={onBackgroundClick}
        >
          <Box
            sx={{
              width:
                containerWidth > 0 ? `${containerWidth * zoomScale}px` : '100%',
              minWidth:
                containerWidth > 0 ? `${containerWidth * zoomScale}px` : '100%',
              flexShrink: 0,
            }}
            ref={containerRef}
          >
            {actionNames.map((actionName) => (
              <TimelineLane
                key={actionName}
                actionName={actionName}
                items={groupedByAction[actionName]}
                selectedIds={selectedIds}
                hoveredItemId={hoveredItemId}
                focusedItemId={focusedItemId}
                onHoverChange={setHoveredItemId}
                onItemClick={handleItemClick}
                onItemContextMenu={handleItemContextMenu}
                timeToPosition={timeToPosition}
                positionToTime={positionToTime}
                currentTimePosition={currentTimePosition}
                formatTime={formatTime}
                firstTeamName={firstTeamName}
                onSeek={onSeek}
                maxSec={maxSec}
                onUpdateTimeRange={onUpdateTimeRange}
                onMoveItem={handleMoveItems}
                laneRef={(el) => {
                  laneRefs.current[actionName] = el;
                }}
                contentWidth={containerWidth}
                zoomScale={zoomScale}
              />
            ))}

            {timeline.length === 0 && (
              <TimelineEmptyState message="タイムラインが空です。アクションボタンでタグ付けを開始してください。" />
            )}
          </Box>

          {isSelecting && selectionBox && (
            <TimelineSelectionOverlay selectionBox={selectionBox} />
          )}
        </Box>
      </Box>

      <TimelineDialogs {...dialogsProps} />
    </Box>
  );
};
