import { useTimelineRangeCommands } from './useTimelineRangeCommands';
import { useTimelineInstanceCommands } from './useTimelineInstanceCommands';
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
import { useTimelineSeek } from './useTimelineSeek';
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
  onSplitTimelineItem,
  onMergeTimelineItems,
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
    canZoomOut,
    canZoomIn,
    zoomIn,
    zoomOut,
    containerWidth,
    timeToPosition,
    positionToTime,
    clientXToContentX,
    clientPointToContainerPoint,
    currentTimePosition,
    scrollLeft,
  } = useTimelineViewport({ maxSec, currentTime });
  const seekHandlers = useTimelineSeek(
    clientXToContentX,
    positionToTime,
    onSeek,
  );
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
    openDraftFromItemId,
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
    useTimelineDerivedData({
      timeline,
      rows,
      maxSec,
      zoomScale,
      containerWidth,
      scrollLeft,
    });

  const suppressClearRef = React.useRef(false);
  const handleSelectionApplied = useCallback((): void => {
    setFocusedItemId(null);
    rowInteractions.clearRowSelection();
    scrollContainerRef.current?.focus({ preventScroll: true });
    suppressClearRef.current = true;
    globalThis.setTimeout(() => {
      suppressClearRef.current = false;
    }, 0);
  }, [rowInteractions, scrollContainerRef, setFocusedItemId]);

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
    overlaySettings,
    overlayChoice,
    chooseOverlay,
    setOverlaySettings,
    clipDialogOpen,
    textPreview,
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
        if (pastedIds.length > 0) onSelectionChange(pastedIds);
        rowInteractions.clearRowSelection();
        scrollContainerRef.current?.focus({ preventScroll: true });
        info(
          pastedIds.length > 0
            ? `${pastedIds.length}件を ${targetActionName} にコピーしました`
            : `${sourceItems.length}件を ${targetActionName} にコピーします`,
        );
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
      rowInteractions,
      scrollContainerRef,
      timeline,
    ],
  );

  const {
    handleCopyTimelineItems,
    handlePasteTimelineItems,
    handleDeleteSelectedItems,
    clearSelection,
    selectAllItems,
  } = useTimelineInstanceCommands({
    timeline,
    rows,
    onDelete,
    onSelectionChange,
    onPasteTimelineItemsToRow,
    rowInteractions,
    scrollContainerRef,
    focusedItemId,
    hoveredItemId,
    contextMenu,
    setFocusedItemId,
    setHoveredItemId,
    handleCloseContextMenu,
    info,
  });

  const rangeCommands = useTimelineRangeCommands({
    timeline,
    selectedIds,
    currentTime,
    onSplitTimelineItem,
    onMergeTimelineItems,
    scrollContainerRef,
  });

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
    onEditItem: openDraftFromItemId,
    onClearSelection: clearSelection,
    onSelectAll: selectAllItems,
    onSplit: rangeCommands.canSplit ? rangeCommands.split : undefined,
    onMerge: rangeCommands.canMerge ? rangeCommands.merge : undefined,
  });

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (isSelecting || selectionBox || suppressClearRef.current) return;
      onSelectionChange([]);
      setFocusedItemId(null);
      setHoveredItemId(null);
      rowInteractions.clearRowSelection();
      scrollContainerRef.current?.focus({ preventScroll: true });
    },
    [
      isSelecting,
      onSelectionChange,
      rowInteractions,
      selectionBox,
      scrollContainerRef,
      setFocusedItemId,
      setHoveredItemId,
    ],
  );

  const dialogsProps = {
    onSplit: onSplitTimelineItem ? rangeCommands.split : undefined,
    onMerge: onMergeTimelineItems ? rangeCommands.merge : undefined,
    canSplit: rangeCommands.canSplit,
    canMerge: rangeCommands.canMerge,
    editingDraft,
    onDialogChange: handleDialogChange,
    onCloseDialog: handleCloseDialog,
    onDeleteSingle: handleDeleteSingle,
    onSaveDialog: handleSaveDialog,
    contextMenu,
    onCloseContextMenu: handleCloseContextMenu,
    onContextMenuEdit: handleContextMenuEdit,
    onContextMenuDelete: () => {
      handleContextMenuDelete();
      requestAnimationFrame(() =>
        scrollContainerRef.current?.focus({ preventScroll: true }),
      );
    },
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
    textPreview,
    onCloseClipDialog: () => setClipDialogOpen(false),
    onExportClips: handleExportClips,
    overlayChoice,
    onOverlayChoice: chooseOverlay,
    overlaySettings,
    setOverlaySettings,
    notePreview: timeline
      .filter((item) => exportScope === 'all' || selectedIds.includes(item.id))
      .filter((item) => item.memo)
      .map((item) => `${item.actionName}: ${item.memo}`)
      .join('\n\n'),
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
    seekHandlers,
    zoomScale,
    canZoomOut,
    canZoomIn,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
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
    handleItemContextMenu: (event, id) => {
      rowInteractions.clearRowSelection();
      handleItemContextMenu(event, id);
    },
    onEditItem: openDraftFromItemId,
    onSelectRowItems: selectAllItems,
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
