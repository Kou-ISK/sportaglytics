import React, { useCallback } from 'react';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';
import { useTimelineRangeSelection } from './hooks/useTimelineRangeSelection';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { useTimelineExportDialogs } from './hooks/useTimelineExportDialogs';
import { useTimelineDerivedData } from './hooks/useTimelineDerivedData';
import { useTimelineGlobalShortcuts } from './hooks/useTimelineGlobalShortcuts';
import { VisualTimelineView } from './VisualTimelineView';
import type { VisualTimelineProps } from './VisualTimeline.types';

export const VisualTimeline: React.FC<VisualTimelineProps> = ({
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
}) => {
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

  const { groupedByAction, actionNames, firstTeamName, formatTime, timeMarkers } =
    useTimelineDerivedData({
      timeline,
      maxSec,
      zoomScale,
    });

  // 範囲選択後のclickによる選択クリアを抑止するフラグ
  const suppressClearRef = React.useRef(false);
  const handleSelectionApplied = useCallback(() => {
    suppressClearRef.current = true;
    // 次のtickで解除
    setTimeout(() => {
      suppressClearRef.current = false;
    }, 0);
  }, []);

  const laneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const getLaneBounds = useCallback(
    (actionName: string) => {
      const el = laneRefs.current[actionName];
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
      if (!el || !scrollRect) return { top: 0, bottom: 0 };
      const rect = el.getBoundingClientRect();
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
      // タイムライン本体（ラベルを除いたレーン領域）の左端オフセット
      laneOffset: (() => {
        const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
        if (!scrollRect) return 0;

        // 実際のレーンコンテナの左端を優先的に使用
        const firstLane = Object.values(laneRefs.current).find(Boolean);
        if (firstLane) {
          return firstLane.getBoundingClientRect().left - scrollRect.left;
        }

        // フォールバック: 全体コンテナから算出
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
    (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      // ドラッグ選択中はクリアしない（mouseup後のclickバブリングを無視）
      if (isSelecting || selectionBox) return;
      if (suppressClearRef.current) return;
      onSelectionChange([]);
    },
    [isSelecting, selectionBox, onSelectionChange],
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
  } satisfies React.ComponentProps<typeof VisualTimelineView>['dialogsProps'];


  return (
    <VisualTimelineView
      zoomScale={zoomScale}
      axisRef={axisRef}
      maxSec={maxSec}
      currentTimePosition={currentTimePosition}
      containerWidth={containerWidth}
      timeMarkers={timeMarkers}
      timeToPosition={timeToPosition}
      positionToTime={positionToTime}
      onSeek={onSeek}
      formatTime={formatTime}
      scrollContainerRef={scrollContainerRef}
      containerRef={containerRef}
      actionNames={actionNames}
      groupedByAction={groupedByAction}
      selectedIds={selectedIds}
      hoveredItemId={hoveredItemId}
      focusedItemId={focusedItemId}
      setHoveredItemId={setHoveredItemId}
      handleItemClick={handleItemClick}
      handleItemContextMenu={handleItemContextMenu}
      firstTeamName={firstTeamName}
      onUpdateTimeRange={onUpdateTimeRange}
      handleMoveItems={handleMoveItems}
      laneRefs={laneRefs}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={(e) => handleMouseUp(e, positionToTime)}
      onBackgroundClick={handleBackgroundClick}
      timeline={timeline}
      isSelecting={isSelecting}
      selectionBox={selectionBox}
      dialogsProps={dialogsProps}
    />
  );
};
