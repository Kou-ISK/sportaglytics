import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import type { TimelineData } from '../../../../../types/TimelineData';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLane } from './TimelineLane';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSelectionOverlay } from './TimelineSelectionOverlay';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { ZoomIndicator } from './ZoomIndicator';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';
import { useTimelineRangeSelection } from './hooks/useTimelineRangeSelection';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { TimelineDialogs } from './TimelineDialogs';
import { useTimelineExportDialogs } from './hooks/useTimelineExportDialogs';
import { useTimelineDerivedData } from './hooks/useTimelineDerivedData';
import { useTimelineGlobalShortcuts } from './hooks/useTimelineGlobalShortcuts';

interface VisualTimelineProps {
  timeline: TimelineData[];
  maxSec: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onDelete: (ids: string[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems?: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  teamNames: string[];
  videoSources?: string[];
  onUndo?: () => void;
  onRedo?: () => void;
  /** プレイリストに追加（位置情報付き） */
  onAddToPlaylist?: (items: TimelineData[]) => void;
}

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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => handleMouseUp(e, positionToTime)}
          onClick={handleBackgroundClick}
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

      <TimelineDialogs
        editingDraft={editingDraft}
        onDialogChange={handleDialogChange}
        onCloseDialog={handleCloseDialog}
        onDeleteSingle={handleDeleteSingle}
        onSaveDialog={handleSaveDialog}
        contextMenu={contextMenu}
        onCloseContextMenu={handleCloseContextMenu}
        onContextMenuEdit={handleContextMenuEdit}
        onContextMenuDelete={handleContextMenuDelete}
        onContextMenuJumpTo={handleContextMenuJumpTo}
        onContextMenuDuplicate={handleContextMenuDuplicate}
        onAddToPlaylist={onAddToPlaylist}
        timeline={timeline}
        selectedIds={selectedIds}
        labelDialogOpen={labelDialogOpen}
        labelGroup={labelGroup}
        labelName={labelName}
        onLabelGroupChange={setLabelGroup}
        onLabelNameChange={setLabelName}
        onCloseLabelDialog={() => setLabelDialogOpen(false)}
        onApplyLabel={handleApplyLabel}
        clipDialogOpen={clipDialogOpen}
        onCloseClipDialog={() => setClipDialogOpen(false)}
        onExportClips={handleExportClips}
        exportScope={exportScope}
        setExportScope={setExportScope}
        exportMode={exportMode}
        setExportMode={setExportMode}
        exportFileName={exportFileName}
        setExportFileName={setExportFileName}
        angleOption={angleOption}
        setAngleOption={setAngleOption}
        selectedAngleIndex={selectedAngleIndex}
        setSelectedAngleIndex={setSelectedAngleIndex}
        videoSources={videoSources}
        primarySource={primarySource}
        secondarySource={secondarySource}
        setPrimarySource={setPrimarySource}
        setSecondarySource={setSecondarySource}
        isExporting={isExporting}
      />
    </Box>
  );
};
