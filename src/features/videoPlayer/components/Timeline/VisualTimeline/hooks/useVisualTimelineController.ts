import React, { useCallback } from 'react';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import { useTimelineViewport } from './useTimelineViewport';
import { useTimelineInteractions } from './useTimelineInteractions';
import { useTimelineRangeSelection } from './useTimelineRangeSelection';
import { useTimelineExportDialogs } from './useTimelineExportDialogs';
import { useTimelineDerivedData } from './useTimelineDerivedData';
import { useTimelineGlobalShortcuts } from './useTimelineGlobalShortcuts';
import type { VisualTimelineProps } from '../VisualTimeline.types';
import type { VisualTimelineViewProps } from '../VisualTimelineView';

export const useVisualTimelineController = ({
  timeline,
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
    currentTimePosition,
  } = useTimelineViewport({ maxSec, currentTime });
  const axisRef = React.useRef<HTMLDivElement>(null);
  const {
    hoveredItemId,
    focusedItemId,
    editingDraft,
    contextMenu,
    setHoveredItemId,
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
  });

  const {
    groupedByAction,
    actionNames,
    firstTeamName,
    formatTime,
    timeMarkers,
  } = useTimelineDerivedData({
    timeline,
    maxSec,
    zoomScale,
  });

  const suppressClearRef = React.useRef(false);
  const handleSelectionApplied = useCallback(() => {
    suppressClearRef.current = true;
    globalThis.setTimeout(() => {
      suppressClearRef.current = false;
    }, 0);
  }, []);

  const laneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const getLaneBounds = useCallback(
    (actionName: string) => {
      const laneElement = laneRefs.current[actionName];
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
      if (!laneElement || !scrollRect) return { top: 0, bottom: 0 };
      const rect = laneElement.getBoundingClientRect();
      const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
      const top = rect.top - scrollRect.top + scrollTop;
      const bottom = rect.bottom - scrollRect.top + scrollTop;
      return { top, bottom };
    },
    [scrollContainerRef],
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
    getSelectionMetrics: () => ({
      rectLeft: scrollContainerRef.current?.getBoundingClientRect().left ?? 0,
      rectTop: scrollContainerRef.current?.getBoundingClientRect().top ?? 0,
      scrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
      laneOffset: (() => {
        const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
        if (!scrollRect) return 0;

        const firstLane = Object.values(laneRefs.current).find(Boolean);
        if (firstLane) {
          return firstLane.getBoundingClientRect().left - scrollRect.left;
        }

        const containerRect = containerRef.current?.getBoundingClientRect();
        return containerRect ? containerRect.left - scrollRect.left : 0;
      })(),
      containerHeight: scrollContainerRef.current?.clientHeight ?? undefined,
    }),
    getLaneBounds,
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
    isExporting,
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
    (ids: string[], targetActionName: string) => {
      if (ids.length === 0) return;
      if (bulkUpdateTimelineItems) {
        bulkUpdateTimelineItems(ids, { actionName: targetActionName });
      } else if (onUpdateTimelineItem) {
        ids.forEach((id) =>
          onUpdateTimelineItem(id, { actionName: targetActionName }),
        );
      }
      info(`${ids.length}件を ${targetActionName} に移動しました`);
    },
    [bulkUpdateTimelineItems, info, onUpdateTimelineItem],
  );

  useTimelineGlobalShortcuts({
    selectedIds,
    timeline,
    scrollContainerRef,
    onSelectionChange,
    onSeek,
    onUndo,
    onRedo,
  });

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (isSelecting || selectionBox) return;
      if (suppressClearRef.current) return;
      onSelectionChange([]);
    },
    [isSelecting, onSelectionChange, selectionBox],
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
    isExporting,
  } satisfies VisualTimelineViewProps['dialogsProps'];

  return {
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
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: (event) => handleMouseUp(event, positionToTime),
    onBackgroundClick: handleBackgroundClick,
    timeline,
    isSelecting,
    selectionBox,
    dialogsProps,
  };
};
