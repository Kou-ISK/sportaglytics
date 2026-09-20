import { useCallback } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineSelection } from './useTimelineSelection';
import { useTimelineContextMenu } from './useTimelineContextMenu';
import { useTimelineEditActions } from './useTimelineEditDraft';

interface UseTimelineInteractionsParams {
  timeline: TimelineData[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSeek: (time: number) => void;
  onDelete: (ids: string[]) => void;
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  onDuplicateTimelineItem?: (id: string) => string | null;
}

export const useTimelineInteractions = ({
  timeline,
  selectedIds,
  onSelectionChange,
  onSeek,
  onDelete,
  onUpdateTimelineItem,
  onUpdateMemo,
  onUpdateTimeRange,
  onDuplicateTimelineItem,
}: UseTimelineInteractionsParams) => {
  // Selection / hover / focus
  const {
    hoveredItemId,
    setHoveredItemId,
    focusedItemId,
    setFocusedItemId,
    handleItemClick,
  } = useTimelineSelection({
    timeline,
    selectedIds,
    onSelectionChange,
  });

  // Context menu
  const {
    contextMenu,
    setContextMenu,
    handleItemContextMenu,
    handleCloseContextMenu,
  } = useTimelineContextMenu({
    selectedIds,
    onSelectionChange,
  });

  // Edit draft & actions
  const {
    editingDraft,
    openDraftFromItemId,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
    handleContextMenuJumpTo,
    handleContextMenuDuplicate,
  } = useTimelineEditActions({
    timeline,
    onDelete,
    onSeek,
    onUpdateTimelineItem,
    onUpdateMemo,
    onUpdateTimeRange,
    onDuplicateTimelineItem,
  });

  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenu) return;
    openDraftFromItemId(contextMenu.itemId);
    setContextMenu(null);
  }, [contextMenu, openDraftFromItemId, setContextMenu]);

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    const ids = selectedIds.includes(contextMenu.itemId)
      ? selectedIds
      : [contextMenu.itemId];
    onDelete(ids);
    onSelectionChange([]);
    setFocusedItemId(null);
    setHoveredItemId(null);
    setContextMenu(null);
  }, [
    contextMenu,
    onDelete,
    onSelectionChange,
    selectedIds,
    setContextMenu,
    setFocusedItemId,
    setHoveredItemId,
  ]);

  const handleContextMenuJumpToWrapped = useCallback(() => {
    if (!contextMenu) return;
    handleContextMenuJumpTo(contextMenu.itemId);
    setContextMenu(null);
  }, [contextMenu, handleContextMenuJumpTo, setContextMenu]);

  const handleContextMenuDuplicateWrapped = useCallback(() => {
    if (!contextMenu) return;
    const duplicatedId = handleContextMenuDuplicate(contextMenu.itemId);
    if (duplicatedId) {
      setFocusedItemId(duplicatedId);
      onSelectionChange([duplicatedId]);
    }
    setContextMenu(null);
  }, [
    contextMenu,
    handleContextMenuDuplicate,
    onSelectionChange,
    setContextMenu,
    setFocusedItemId,
  ]);

  return {
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
    handleContextMenuJumpTo: handleContextMenuJumpToWrapped,
    handleContextMenuDuplicate: handleContextMenuDuplicateWrapped,
    openDraftFromItemId,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
  };
};
