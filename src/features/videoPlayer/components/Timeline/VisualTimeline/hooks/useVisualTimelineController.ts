import React, { useCallback } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { buildTimelineRowMoveUpdates } from '../../../../shared/timelineRows';
import type { VisualTimelineProps } from '../VisualTimeline.types';
import type { VisualTimelineViewProps } from '../VisualTimelineView';
import { useTimelineDerivedData } from './useTimelineDerivedData';
import { useTimelineExportDialogs } from './useTimelineExportDialogs';
import { useTimelineGlobalShortcuts } from './useTimelineGlobalShortcuts';
import { useTimelineInteractions } from './useTimelineInteractions';
import { useTimelineRangeSelection } from './useTimelineRangeSelection';
import { useTimelineRowInteractions } from './useTimelineRowInteractions';
import { useTimelineViewport } from './useTimelineViewport';

export const useVisualTimelineController = ({
  timeline,
  rows,
  maxSec,
  currentTime,
  onSeek,
  onDelete,
  selectedIds,
  onSelectionChange,
  onUpdateMemo,
  onUpdateTimeRange,
  onUpdateTimelineItem,
  bulkUpdateTimelineItems,
  onDuplicateTimelineItem,
  onCreateTimelineItem,
  onAddRow,
  onUpdateRow,
  onMoveRow,
  onDeleteRows,
  onPasteTimelineItemsToRow,
  videoSources,
  onUndo,
  onRedo,
  onAddToPlaylist,
}: VisualTimelineProps): VisualTimelineViewProps => {
  const {
    containerRef,
    scrollContainerRef,
    zoomScale,
    containerWidth,
    timeToPosition,
    positionToTime,
    clientXToContentX,
    clientPointToContainerPoint,
    currentTimePosition,
    scrollLeft,
  } = useTimelineViewport({ maxSec, currentTime });
  const axisRef = React.useRef<HTMLDivElement>(null);
  const rowInteractions = useTimelineRowInteractions({
    rows,
    onInstanceSelectionChange: onSelectionChange,
    onUpdateRow,
    onMoveRow,
    onDeleteRows,
  });
  const {
    hoveredItemId,
    focusedItemId,
    editingDraft,
    contextMenu,
    setHoveredItemId,
    setFocusedItemId,
    handleItemClick,
    handleItemContextMenu,
    handleCloseContextMenu,
    handleContextMenuEdit,
    handleContextMenuDelete,
    handleContextMenuJumpTo,
    handleContextMenuDuplicate,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
  } = useTimelineInteractions({
    timeline,
    selectedIds,
    onSelectionChange,
    onSeek,
    onDelete,
    onUpdateTimelineItem,
    onUpdateMemo,
    onUpdateTimeRange,
    onDuplicateTimelineItem,
  });

  const handleTimelineItemClick = useCallback(
    (event: React.MouseEvent, id: string): void => {
      rowInteractions.clearRowSelection();
      handleItemClick(event, id);
    },
    [handleItemClick, rowInteractions],
  );

  const { groupedByAction, firstTeamName, formatTime, timeMarkers } =
    useTimelineDerivedData({ timeline, rows, maxSec, zoomScale });

  const suppressClearRef = React.useRef(false);
  const handleSelectionApplied = useCallback((): void => {
    suppressClearRef.current = true;
    globalThis.setTimeout(() => {
      suppressClearRef.current = false;
    }, 0);
  }, []);

  const laneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const getLaneBounds = useCallback(
    (actionName: string): { top: number; bottom: number } => {
      const laneElement = laneRefs.current[actionName];
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!laneElement || !containerRect) return { top: 0, bottom: 0 };
      const rect = laneElement.getBoundingClientRect();
      return {
        top: rect.top - containerRect.top,
        bottom: rect.bottom - containerRect.top,
      };
    },
    [containerRef],
  );

  const getContainerSize = useCallback(
    (): { width: number; height: number } => ({
      width: containerRef.current?.clientWidth ?? 0,
      height: containerRef.current?.clientHeight ?? 0,
    }),
    [containerRef],
  );

  const {
    isSelecting,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useTimelineRangeSelection({
    timeline,
    selectedIds,
    getContainerPoint: clientPointToContainerPoint,
    getContainerSize,
    getLaneBounds,
    contentXToTime: positionToTime,
    onSelectionChange,
    onSelectionApplied: handleSelectionApplied,
  });

  const { info } = useNotification();
  const {
    labelDialogOpen,
    setLabelDialogOpen,
    labelGroup,
    setLabelGroup,
    labelName,
    setLabelName,
    handleApplyLabel,
    clipDialogOpen,
    setClipDialogOpen,
    primarySource,
    setPrimarySource,
    secondarySource,
    setSecondarySource,
    exportScope,
    setExportScope,
    exportMode,
    setExportMode,
    angleOption,
    setAngleOption,
    selectedAngleIndex,
    setSelectedAngleIndex,
    exportFileName,
    setExportFileName,
    handleExportClips,
  } = useTimelineExportDialogs({
    timeline,
    selectedIds,
    videoSources,
    onUpdateTimelineItem,
    info,
  });

  const handleMoveItems = useCallback(
    (ids: string[], targetActionName: string, operation: 'move' | 'copy') => {
      if (ids.length === 0) return;
      if (operation === 'copy') {
        const targetRow = rows.find((row) => row.name === targetActionName);
        const sourceItems = timeline.filter((item) => ids.includes(item.id));
        if (
          !targetRow ||
          !onPasteTimelineItemsToRow ||
          sourceItems.length === 0
        )
          return;
        const pastedIds = onPasteTimelineItemsToRow(sourceItems, targetRow.id);
        onSelectionChange(pastedIds);
        info(`${pastedIds.length}件を ${targetActionName} にコピーしました`);
        return;
      }
      const isAlreadyInTarget = timeline
        .filter((item) => ids.includes(item.id))
        .every((item) => item.actionName === targetActionName);
      if (isAlreadyInTarget) return;
      const updates = buildTimelineRowMoveUpdates(rows, targetActionName);
      if (bulkUpdateTimelineItems) {
        bulkUpdateTimelineItems(ids, updates);
      } else if (onUpdateTimelineItem) {
        ids.forEach((id) => onUpdateTimelineItem(id, updates));
      }
      info(`${ids.length}件を ${targetActionName} に移動しました`);
    },
    [
      bulkUpdateTimelineItems,
      info,
      onPasteTimelineItemsToRow,
      onSelectionChange,
      onUpdateTimelineItem,
      rows,
      timeline,
    ],
  );

  const copiedItemsRef = React.useRef<typeof timeline>([]);
  const handleCopyTimelineItems = useCallback(
    (items: typeof timeline): void => {
      copiedItemsRef.current = items.map((item) => ({
        ...item,
        labels: item.labels?.map((label) => ({ ...label })),
      }));
      info(`${items.length}件のインスタンスをコピーしました`);
    },
    [info],
  );

  const handlePasteTimelineItems = useCallback(
    (targetRowId: string): void => {
      const copiedItems = copiedItemsRef.current;
      if (copiedItems.length === 0 || !onPasteTimelineItemsToRow) return;
      const pastedIds = onPasteTimelineItemsToRow(copiedItems, targetRowId);
      if (pastedIds.length === 0) return;
      onSelectionChange(pastedIds);
      rowInteractions.clearRowSelection();
      info(`${pastedIds.length}件のインスタンスを貼り付けました`);
    },
    [info, onPasteTimelineItemsToRow, onSelectionChange, rowInteractions],
  );

  const handleDeleteSelectedItems = useCallback(
    (ids: string[]): void => {
      if (ids.length === 0) return;
      const deletedIds = new Set(ids);
      onDelete(ids);
      onSelectionChange([]);
      if (focusedItemId && deletedIds.has(focusedItemId)) {
        setFocusedItemId(null);
      }
      if (hoveredItemId && deletedIds.has(hoveredItemId)) {
        setHoveredItemId(null);
      }
      if (contextMenu && deletedIds.has(contextMenu.itemId)) {
        handleCloseContextMenu();
      }
    },
    [
      contextMenu,
      focusedItemId,
      handleCloseContextMenu,
      hoveredItemId,
      onDelete,
      onSelectionChange,
      setFocusedItemId,
      setHoveredItemId,
    ],
  );

  useTimelineGlobalShortcuts({
    selectedIds,
    timeline,
    scrollContainerRef,
    onSelectionChange,
    onSeek,
    onUndo,
    onRedo,
    onAddToPlaylist,
    selectedRowIds: rowInteractions.selectedRowIds,
    onCopyItems: handleCopyTimelineItems,
    onPasteItems: handlePasteTimelineItems,
    onDeleteItems: handleDeleteSelectedItems,
    onRequestDeleteRows: rowInteractions.onRequestDeleteRows,
  });

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (isSelecting || selectionBox || suppressClearRef.current) return;
      onSelectionChange([]);
      rowInteractions.clearRowSelection();
    },
    [isSelecting, onSelectionChange, rowInteractions, selectionBox],
  );

  const dialogsProps = {
    editingDraft,
    onDialogChange: handleDialogChange,
    onCloseDialog: handleCloseDialog,
    onDeleteSingle: handleDeleteSingle,
    onSaveDialog: handleSaveDialog,
    contextMenu,
    onCloseContextMenu: handleCloseContextMenu,
    onContextMenuEdit: handleContextMenuEdit,
    onContextMenuDelete: handleContextMenuDelete,
    onContextMenuJumpTo: handleContextMenuJumpTo,
    onContextMenuDuplicate: handleContextMenuDuplicate,
    onAddToPlaylist,
    timeline,
    selectedIds,
    labelDialogOpen,
    labelGroup,
    labelName,
    onLabelGroupChange: setLabelGroup,
    onLabelNameChange: setLabelName,
    onCloseLabelDialog: () => setLabelDialogOpen(false),
    onApplyLabel: handleApplyLabel,
    clipDialogOpen,
    onCloseClipDialog: () => setClipDialogOpen(false),
    onExportClips: handleExportClips,
    exportScope,
    setExportScope,
    exportMode,
    setExportMode,
    exportFileName,
    setExportFileName,
    angleOption,
    setAngleOption,
    selectedAngleIndex,
    setSelectedAngleIndex,
    videoSources,
    primarySource,
    secondarySource,
    setPrimarySource,
    setSecondarySource,
  } satisfies VisualTimelineViewProps['dialogsProps'];

  return {
    zoomScale,
    scrollLeft,
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
    handleItemClick: handleTimelineItemClick,
    handleItemContextMenu,
    firstTeamName,
    onUpdateTimeRange,
    handleMoveItems,
    onCreateTimelineItem,
    onAddRow,
    onUpdateRow,
    selectedRowIds: rowInteractions.selectedRowIds,
    editingRow: rowInteractions.editingRow,
    rowNameDraft: rowInteractions.rowNameDraft,
    rowColorDraft: rowInteractions.rowColorDraft,
    rowContextMenu: rowInteractions.rowContextMenu,
    rowsPendingDeletion: rowInteractions.rowsPendingDeletion,
    onRowNameDraftChange: rowInteractions.onRowNameDraftChange,
    onRowColorDraftChange: rowInteractions.onRowColorDraftChange,
    onOpenRowEditor: rowInteractions.onOpenRowEditor,
    onCloseRowEditor: rowInteractions.onCloseRowEditor,
    onSaveRow: rowInteractions.onSaveRow,
    onRowClick: rowInteractions.onRowClick,
    onRowContextMenu: rowInteractions.onRowContextMenu,
    onRowDragStart: rowInteractions.onRowDragStart,
    onRowDragOver: rowInteractions.onRowDragOver,
    onRowDrop: rowInteractions.onRowDrop,
    onCloseRowContextMenu: rowInteractions.onCloseRowContextMenu,
    onEditContextRow: rowInteractions.onEditContextRow,
    onMoveSelectedRow: rowInteractions.onMoveSelectedRow,
    onRequestDeleteRows: rowInteractions.onRequestDeleteRows,
    onCancelDeleteRows: rowInteractions.onCancelDeleteRows,
    onConfirmDeleteRows: rowInteractions.onConfirmDeleteRows,
    laneRefs,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onBackgroundClick: handleBackgroundClick,
    isSelecting,
    selectionBox,
    dialogsProps,
  };
};
