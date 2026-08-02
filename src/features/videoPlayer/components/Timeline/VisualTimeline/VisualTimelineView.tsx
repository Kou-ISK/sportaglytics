import React from 'react';
import Add from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../../types/timeline/core';
import { TimelineAxis } from './TimelineAxis';
import { TimelineDialogs } from './TimelineDialogs';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineLane } from './TimelineLane';
import { TimelineSelectionOverlay } from './TimelineSelectionOverlay';
import { ZoomIndicator } from './ZoomIndicator';
import { TimelineRowEditorDialog } from './TimelineRowEditorDialog';

export interface VisualTimelineViewProps {
  zoomScale: number;
  scrollLeft: number;
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
  rows: TimelineRow[];
  groupedByAction: Record<string, TimelineData[]>;
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  handleItemClick: React.ComponentProps<typeof TimelineLane>['onItemClick'];
  handleItemContextMenu: (e: React.MouseEvent, id: string) => void;
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
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onBackgroundClick: (e: React.MouseEvent) => void;
  isSelecting: boolean;
  selectionBox:
    | React.ComponentProps<typeof TimelineSelectionOverlay>['selectionBox']
    | null;
  dialogsProps: React.ComponentProps<typeof TimelineDialogs>;
}

export const VisualTimelineView = ({
  zoomScale,
  scrollLeft,
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
  rows,
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
      <ZoomIndicator zoomScale={zoomScale} />
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
          sx={{
            flex: '0 0 auto',
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
            scrollLeft={scrollLeft}
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
                containerWidth > 0
                  ? `${120 + containerWidth * zoomScale}px`
                  : '100%',
              minWidth:
                containerWidth > 0
                  ? `${120 + containerWidth * zoomScale}px`
                  : '100%',
              flexShrink: 0,
            }}
            ref={containerRef}
          >
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
                timeToPosition={timeToPosition}
                positionToTime={positionToTime}
                currentTimePosition={currentTimePosition}
                formatTime={formatTime}
                firstTeamName={firstTeamName}
                onSeek={onSeek}
                maxSec={maxSec}
                onUpdateTimeRange={onUpdateTimeRange}
                onMoveItem={handleMoveItems}
                onCreateItem={onCreateTimelineItem}
                onEditRow={() => onOpenRowEditor(row)}
                onRowClick={onRowClick}
                onRowContextMenu={onRowContextMenu}
                onRowDragStart={onRowDragStart}
                onRowDragOver={onRowDragOver}
                onRowDrop={onRowDrop}
                laneRef={(el) => {
                  laneRefs.current[row.name] = el;
                }}
                contentWidth={containerWidth}
                zoomScale={zoomScale}
              />
            ))}

            {rows.length === 0 && (
              <TimelineEmptyState message="タイムラインが空です。アクションボタンでタグ付けを開始してください。" />
            )}

            {onAddRow && (
              <Box
                sx={{
                  position: 'sticky',
                  left: 0,
                  width: 120,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  pt: 0.5,
                }}
              >
                <Tooltip title="行を追加">
                  <IconButton
                    size="small"
                    aria-label="行を追加"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddRow();
                    }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>

          {isSelecting && selectionBox && (
            <TimelineSelectionOverlay selectionBox={selectionBox} />
          )}
        </Box>
      </Box>

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
      <Menu
        open={rowContextMenu !== null}
        onClose={onCloseRowContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          rowContextMenu
            ? { top: rowContextMenu.mouseY, left: rowContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={onEditContextRow}>
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          行を編集
        </MenuItem>
        <MenuItem
          onClick={() => onMoveSelectedRow(-1)}
          disabled={
            !rowContextMenu ||
            rows.findIndex((row) => row.id === rowContextMenu.rowId) <= 0
          }
        >
          <ListItemIcon>
            <KeyboardArrowUp fontSize="small" />
          </ListItemIcon>
          上へ移動
        </MenuItem>
        <MenuItem
          onClick={() => onMoveSelectedRow(1)}
          disabled={
            !rowContextMenu ||
            rows.findIndex((row) => row.id === rowContextMenu.rowId) >=
              rows.length - 1
          }
        >
          <ListItemIcon>
            <KeyboardArrowDown fontSize="small" />
          </ListItemIcon>
          下へ移動
        </MenuItem>
        <MenuItem onClick={() => onRequestDeleteRows()}>
          <ListItemIcon>
            <DeleteOutline fontSize="small" color="error" />
          </ListItemIcon>
          行を削除
        </MenuItem>
      </Menu>
      <Dialog
        open={rowsPendingDeletion.length > 0}
        onClose={onCancelDeleteRows}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {rowsPendingDeletion.length === 1
            ? `「${rowsPendingDeletion[0]?.name}」を削除しますか？`
            : `${rowsPendingDeletion.length}行を削除しますか？`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            行に含まれるインスタンスも削除されます。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelDeleteRows}>キャンセル</Button>
          <Button
            onClick={onConfirmDeleteRows}
            color="error"
            variant="contained"
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
