import React, { useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import { TimelineData } from '../../../../../types/TimelineData';
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

  const groupedByAction = useMemo(() => {
    const groups: Record<string, TimelineData[]> = {};
    for (const item of timeline) {
      const actionName = item.actionName;
      if (!groups[actionName]) {
        groups[actionName] = [];
      }
      groups[actionName].push(item);
    }
    return groups;
  }, [timeline]);

  const actionNames = useMemo(
    () => Object.keys(groupedByAction).sort((a, b) => a.localeCompare(b)),
    [groupedByAction],
  );

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
    overlaySettings,
    setOverlaySettings,
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

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    if (maxSec <= 0) return markers;

    // 映像の総時間に基づいた基本の目盛り間隔を決定
    // きりの良い5の倍数の秒数を使用（10秒、30秒、1分、5分、10分など）
    // ズーム100%で画面に収まる適切な数（約8〜15個程度）の目盛りを表示
    const getBaseInterval = (duration: number): number => {
      if (duration <= 60) return 10; // 〜1分: 10秒単位
      if (duration <= 300) return 30; // 〜5分: 30秒単位
      if (duration <= 600) return 60; // 〜10分: 1分単位
      if (duration <= 1800) return 300; // 〜30分: 5分単位
      if (duration <= 3600) return 600; // 〜1時間: 10分単位
      return 600; // それ以上: 10分単位
    };

    // ズーム時も5の倍数の間隔を維持
    // 利用可能な間隔: 5秒, 10秒, 30秒, 1分, 5分, 10分
    const ALLOWED_INTERVALS = [5, 10, 30, 60, 300, 600];

    const baseInterval = getBaseInterval(maxSec);
    const targetInterval = baseInterval / zoomScale;

    // targetIntervalに最も近い許可された間隔を選択
    const interval = ALLOWED_INTERVALS.reduce((prev, curr) =>
      Math.abs(curr - targetInterval) < Math.abs(prev - targetInterval)
        ? curr
        : prev,
    );

    for (let i = 0; i <= maxSec; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [maxSec, zoomScale]);

  const firstTeamName = actionNames[0]?.split(' ')[0];


  // グローバルKeyDownでTabジャンプ・Undo/Redoを処理（選択があるときのみ）
  React.useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isFormElement =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        tag === 'button';
      const isInsideTimeline =
        !!scrollContainerRef.current &&
        !!target &&
        scrollContainerRef.current.contains(target);

      // 選択中アクションの次/前インスタンスへジャンプ
      // Tab / Shift+Tab または Option+↓ / Option+↑
      const isJumpNext = e.key === 'Tab' || (e.altKey && e.key === 'ArrowDown');
      const isJumpPrev =
        (e.key === 'Tab' && e.shiftKey) || (e.altKey && e.key === 'ArrowUp');

      if (isJumpNext || isJumpPrev) {
        // Tabはデフォルト動作を抑止
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
        }

        if (selectedIds.length > 0) {
          // Option+矢印の場合もデフォルト動作を抑止
          if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
          }

          const items = [...timeline].sort((a, b) => a.startTime - b.startTime);
          const current = items.find((t) => selectedIds.includes(t.id));
          if (current) {
            const same = items.filter(
              (t) => t.actionName === current.actionName,
            );
            const idx = same.findIndex((t) => t.id === current.id);
            if (idx !== -1) {
              const direction: 1 | -1 = isJumpPrev ? -1 : 1;
              const nextIdx =
                (idx + direction + same.length) % Math.max(same.length, 1);
              const targetItem = same[nextIdx];
              if (targetItem) {
                onSelectionChange([targetItem.id]);
                onSeek(targetItem.startTime);
              }
            }
          }
        }
        return;
      }

      // Undo/Redo（フォーム要素以外）
      if (
        isInsideTimeline &&
        !isFormElement &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal, true);
    return () =>
      window.removeEventListener('keydown', handleKeyDownGlobal, true);
  }, [selectedIds, timeline, onSelectionChange, onSeek, onRedo, onUndo]);

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
