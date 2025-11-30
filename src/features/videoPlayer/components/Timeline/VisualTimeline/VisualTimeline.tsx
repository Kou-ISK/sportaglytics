import React, { useMemo, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { TimelineData } from '../../../../../types/TimelineData';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLane } from './TimelineLane';
import { TimelineEditDialog } from './TimelineEditDialog';
import { TimelineContextMenu } from './TimelineContextMenu';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { ZoomIndicator } from './ZoomIndicator';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';
import { useTimelineRangeSelection } from './hooks/useTimelineRangeSelection';
import { BulkMoveDialog } from './BulkMoveDialog';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';
import { useNotification } from '../../../../../contexts/NotificationContext';
interface VisualTimelineProps {
  timeline: TimelineData[];
  maxSec: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onDelete: (ids: string[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdateQualifier?: (id: string, qualifier: string) => void;
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
  onUndo?: () => void;
  onRedo?: () => void;
}

export const VisualTimeline: React.FC<VisualTimelineProps> = ({
  timeline,
  maxSec,
  currentTime,
  onSeek,
  onDelete,
  selectedIds,
  onSelectionChange,
  onUpdateQualifier,
  onUpdateTimeRange,
  onUpdateTimelineItem,
  bulkUpdateTimelineItems,
  teamNames,
  onUndo,
  onRedo,
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
    handleKeyDown,
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
    onUpdateQualifier,
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

  const {
    isSelecting,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useTimelineRangeSelection({
    timeline,
    getSelectionMetrics: () => ({
      rectLeft:
        scrollContainerRef.current?.getBoundingClientRect().left ?? 0,
      rectTop: scrollContainerRef.current?.getBoundingClientRect().top ?? 0,
      scrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
      laneOffset:
        (containerRef.current?.getBoundingClientRect().left ?? 0) -
        (scrollContainerRef.current?.getBoundingClientRect().left ?? 0),
      containerHeight: scrollContainerRef.current?.clientHeight ?? undefined,
    }),
    onSelectionChange,
  });

  const { activeActions } = useActionPreset();
  const { info } = useNotification();
  const [moveDialogOpen, setMoveDialogOpen] = React.useState(false);

  const handleBulkMove = (team: string, action: string) => {
    if (!bulkUpdateTimelineItems || selectedIds.length === 0) return;
    const actionName = `${team} ${action}`;
    bulkUpdateTimelineItems(selectedIds, { actionName });
    info(`${selectedIds.length}件を ${actionName} に移動しました`);
    setMoveDialogOpen(false);
  };

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

    // 目盛りの間隔: 動画の長さに応じて調整（より広めに）
    let interval: number;
    if (maxSec <= 120) {
      interval = 15;
    } else if (maxSec <= 300) {
      interval = 30;
    } else if (maxSec <= 600) {
      interval = 60;
    } else if (maxSec <= 1800) {
      interval = 120;
    } else {
      interval = 300;
    }

    for (let i = 0; i <= maxSec; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [maxSec]);

  const firstTeamName = actionNames[0]?.split(' ')[0];

  const selectionActionsVisible = selectedIds.length > 0;

  const handleKeyDownWithUndo = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        event.preventDefault();
        return;
      }
      handleKeyDown(event);
    },
    [handleKeyDown, onRedo, onUndo],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
      onKeyDown={handleKeyDownWithUndo}
    >
      <ZoomIndicator zoomScale={zoomScale} />

      {selectionActionsVisible && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 16,
            zIndex: 20,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            bgcolor: 'background.paper',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <Typography variant="caption" sx={{ mr: 1 }}>
            選択中: {selectedIds.length}件
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => setMoveDialogOpen(true)}
          >
            アクション変更
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onDelete(selectedIds)}
          >
            削除
          </Button>
        </Box>
      )}

      <Box
        sx={{ position: 'relative', flex: 1 }}
      >
        <Box
          ref={scrollContainerRef}
          sx={{
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            overflowX: zoomScale > 1 ? 'auto' : 'hidden',
            px: 2,
            pt: 2,
            pb: 2,
            height: '100%',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => handleMouseUp(e, positionToTime)}
        >
          <Box
            sx={{
              minWidth:
                containerWidth > 0 ? `${containerWidth * zoomScale}px` : '100%',
            }}
          >
            <TimelineAxis
              containerRef={containerRef}
              maxSec={maxSec}
              currentTimePosition={currentTimePosition}
              timeMarkers={timeMarkers}
              timeToPosition={timeToPosition}
              onSeek={onSeek}
              formatTime={formatTime}
            />

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
              />
            ))}

            {timeline.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  タイムラインが空です。アクションボタンでタグ付けを開始してください。
                </Typography>
              </Box>
            )}
          </Box>

          {isSelecting && selectionBox && (
            <Box
              sx={{
                position: 'absolute',
                top: selectionBox.top,
                left: selectionBox.left,
                width: selectionBox.width,
                height: selectionBox.height,
                border: '1px dashed',
                borderColor: 'primary.main',
                bgcolor: 'primary.main',
                opacity: 0.1,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>
      </Box>

      <TimelineEditDialog
        draft={editingDraft}
        open={Boolean(editingDraft)}
        onChange={handleDialogChange}
        onClose={handleCloseDialog}
        onDelete={handleDeleteSingle}
        onSave={handleSaveDialog}
      />

      <TimelineContextMenu
        anchorPosition={contextMenu?.position || null}
        onClose={handleCloseContextMenu}
        onEdit={handleContextMenuEdit}
        onDelete={handleContextMenuDelete}
        onJumpTo={handleContextMenuJumpTo}
        onDuplicate={handleContextMenuDuplicate}
      />

      <BulkMoveDialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        onSubmit={handleBulkMove}
        teamNames={teamNames}
        actions={activeActions}
        selectedCount={selectedIds.length}
      />
    </Box>
  );
};
