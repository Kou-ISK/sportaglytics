import type { AngleSyncSnapshot } from '../../../../../types/ipc/angleSync';
import { TimelineSyncMarkersView } from './TimelineSyncMarkersView';
import React from 'react';
import { Box } from '@mui/material';
import { TimelineRowActionsView } from './TimelineRowActionsView';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../../types/timeline/core';
import { TimelinePlayhead } from './TimelinePlayhead';
import type { useTimelineSeek } from './hooks/useTimelineSeek';
import { TimelineAxis } from './TimelineAxis';
import { TimelineDialogs } from './TimelineDialogs';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineFooter } from './TimelineFooter';
import { TimelineLane } from './TimelineLane';
import { TimelineSelectionOverlay } from './TimelineSelectionOverlay';
import { TimelineRowEditorDialog } from './TimelineRowEditorDialog';
import { TIMELINE_ROW_HEADER_WIDTH_PX } from './domain/timelineCoordinateMapper';

export interface VisualTimelineViewProps {
  angleSync?: AngleSyncSnapshot;
  seekHandlers: ReturnType<typeof useTimelineSeek>;
  zoomScale: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  scrollLeft: number;
  axisRef: React.RefObject<HTMLDivElement | null>;
  maxSec: number;
  currentTimePosition: number;
  containerWidth: number;
  timeMarkers: number[];
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  clientXToContentX: (clientX: number) => number;
  onSeek: (time: number) => void;
  formatTime: (seconds: number) => string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rows: TimelineRow[];
  groupedByAction: Record<string, TimelineData[]>;
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  handleItemClick: React.ComponentProps<typeof TimelineLane>['onItemClick'];
  onEditItem?: (id: string) => void;
  onSelectRowItems?: () => void;
  handleItemContextMenu: (event: React.MouseEvent, id: string) => void;
  firstTeamName?: string;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  handleMoveItems: (
    ids: string[],
    targetActionName: string,
    operation: 'move' | 'copy',
  ) => void;
  onCreateTimelineItem?: (
    actionName: string,
    startTime: number,
    endTime: number,
    color: string,
  ) => void;
  onAddRow?: (name?: string, color?: string) => void;
  onUpdateRow?: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  selectedRowIds: string[];
  editingRow: TimelineRow | null;
  rowNameDraft: string;
  rowColorDraft: string;
  onRowNameDraftChange: (value: string) => void;
  onRowColorDraftChange: (value: string) => void;
  onOpenRowEditor: (row: TimelineRow) => void;
  onCloseRowEditor: () => void;
  onSaveRow: () => void;
  rowContextMenu: { rowId: string; mouseX: number; mouseY: number } | null;
  rowsPendingDeletion: TimelineRow[];
  onRowClick: (event: React.MouseEvent, rowId: string) => void;
  onRowContextMenu: (event: React.MouseEvent, rowId: string) => void;
  onRowDragStart: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  onRowDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onRowDrop: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  onCloseRowContextMenu: () => void;
  onEditContextRow: () => void;
  onMoveSelectedRow: (direction: -1 | 1) => void;
  onRequestDeleteRows: (ids?: string[]) => void;
  onCancelDeleteRows: () => void;
  onConfirmDeleteRows: () => void;
  laneRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onMouseDown: (event: React.MouseEvent) => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseUp: (event: React.MouseEvent) => void;
  onBackgroundClick: (event: React.MouseEvent) => void;
  isSelecting: boolean;
  selectionBox:
    | React.ComponentProps<typeof TimelineSelectionOverlay>['selectionBox']
    | null;
  dialogsProps: React.ComponentProps<typeof TimelineDialogs>;
}

export const VisualTimelineView = ({
  angleSync,
  seekHandlers,
  scrollLeft,
  zoomScale,
  canZoomOut,
  canZoomIn,
  onZoomOut,
  onZoomIn,
  axisRef,
  maxSec,
  currentTimePosition,
  containerWidth,
  timeMarkers,
  timeToPosition,
  positionToTime,
  clientXToContentX,
  onSeek,
  formatTime,
  scrollContainerRef,
  containerRef,
  rows,
  groupedByAction,
  selectedIds,
  hoveredItemId,
  focusedItemId,
  setHoveredItemId,
  handleItemClick,
  handleItemContextMenu,
  onEditItem,
  onSelectRowItems,
  firstTeamName,
  onUpdateTimeRange,
  handleMoveItems,
  onCreateTimelineItem,
  onAddRow,
  selectedRowIds,
  editingRow,
  rowNameDraft,
  rowColorDraft,
  onRowNameDraftChange,
  onRowColorDraftChange,
  onOpenRowEditor,
  onCloseRowEditor,
  onSaveRow,
  rowContextMenu,
  rowsPendingDeletion,
  onRowClick,
  onRowContextMenu,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onCloseRowContextMenu,
  onEditContextRow,
  onMoveSelectedRow,
  onRequestDeleteRows,
  onCancelDeleteRows,
  onConfirmDeleteRows,
  laneRefs,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onBackgroundClick,
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
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          ref={scrollContainerRef}
          tabIndex={0}
          role="region"
          aria-label="タイムライン"
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            maxHeight: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            px: 0,
            pt: 0,
            pb: 0,
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
              position: 'relative',
              width:
                containerWidth > 0
                  ? `${TIMELINE_ROW_HEADER_WIDTH_PX + containerWidth * zoomScale}px`
                  : '100%',
              minWidth:
                containerWidth > 0
                  ? `${TIMELINE_ROW_HEADER_WIDTH_PX + containerWidth * zoomScale}px`
                  : '100%',
              minHeight: '100%',
              flexShrink: 0,
            }}
            ref={containerRef}
          >
            <TimelineAxis
              axisRef={axisRef}
              seekHandlers={seekHandlers}
              contentWidth={containerWidth * zoomScale}
              timeMarkers={timeMarkers}
              timeToPosition={timeToPosition}
              formatTime={formatTime}
            >
              {angleSync && (
                <TimelineSyncMarkersView
                  state={angleSync}
                  timeToPosition={timeToPosition}
                />
              )}
            </TimelineAxis>
            {rows.map((row) => (
              <TimelineLane
                key={row.id}
                rowId={row.id}
                actionName={row.name}
                rowColor={row.color}
                isRowSelected={selectedRowIds.includes(row.id)}
                items={groupedByAction[row.name] ?? []}
                selectedIds={selectedIds}
                hoveredItemId={hoveredItemId}
                focusedItemId={focusedItemId}
                onHoverChange={setHoveredItemId}
                onItemClick={handleItemClick}
                onItemContextMenu={handleItemContextMenu}
                onEditItem={onEditItem}
                timeToPosition={timeToPosition}
                positionToTime={positionToTime}
                clientXToContentX={clientXToContentX}
                currentTimePosition={currentTimePosition}
                formatTime={formatTime}
                firstTeamName={firstTeamName}
                maxSec={maxSec}
                onUpdateTimeRange={onUpdateTimeRange}
                onPreviewTime={onSeek}
                onMoveItem={handleMoveItems}
                onCreateItem={onCreateTimelineItem}
                onEditRow={() => onOpenRowEditor(row)}
                onRowClick={onRowClick}
                onRowContextMenu={onRowContextMenu}
                onRowDragStart={onRowDragStart}
                onRowDragOver={onRowDragOver}
                onRowDrop={onRowDrop}
                laneRef={(element) => {
                  laneRefs.current[row.name] = element;
                }}
                contentWidth={containerWidth}
                zoomScale={zoomScale}
              />
            ))}

            {rows.length === 0 && (
              <TimelineEmptyState message="タイムラインが空です。アクションボタンでタグ付けを開始してください。" />
            )}

            <TimelinePlayhead
              hidden={currentTimePosition < scrollLeft}
              position={currentTimePosition}
              maxSec={maxSec}
              currentTime={positionToTime(currentTimePosition)}
              formatTime={formatTime}
              onSeek={onSeek}
              seekHandlers={seekHandlers}
            />
            {isSelecting && selectionBox && (
              <TimelineSelectionOverlay selectionBox={selectionBox} />
            )}
          </Box>
        </Box>
      </Box>

      <TimelineFooter
        rowCount={rows.length}
        selectedCount={selectedIds.length}
        zoomScale={zoomScale}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        onZoomOut={onZoomOut}
        onZoomIn={onZoomIn}
        onAddRow={onAddRow}
      />

      <TimelineDialogs {...dialogsProps} />
      <TimelineRowEditorDialog
        open={editingRow !== null}
        name={rowNameDraft}
        color={rowColorDraft}
        onNameChange={onRowNameDraftChange}
        onColorChange={onRowColorDraftChange}
        onClose={onCloseRowEditor}
        onSave={onSaveRow}
      />
      <TimelineRowActionsView
        rows={rows}
        rowContextMenu={rowContextMenu}
        rowsPendingDeletion={rowsPendingDeletion}
        onCloseRowContextMenu={onCloseRowContextMenu}
        onEditContextRow={onEditContextRow}
        onMoveSelectedRow={onMoveSelectedRow}
        onRequestDeleteRows={onRequestDeleteRows}
        onCancelDeleteRows={onCancelDeleteRows}
        onConfirmDeleteRows={onConfirmDeleteRows}
        onSelectRowItems={onSelectRowItems}
      />
    </Box>
  );
};
