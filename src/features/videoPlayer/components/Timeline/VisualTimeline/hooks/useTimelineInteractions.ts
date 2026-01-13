import { useCallback } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
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
    onSeek,
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
  });

  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenu) return;
    openDraftFromItemId(contextMenu.itemId);
    setContextMenu(null);
  }, [contextMenu, openDraftFromItemId, setContextMenu]);

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    onDelete([contextMenu.itemId]);
    setContextMenu(null);
  }, [contextMenu, onDelete, setContextMenu]);

  const handleContextMenuJumpToWrapped = useCallback(() => {
    if (!contextMenu) return;
    handleContextMenuJumpTo(contextMenu.itemId);
    setContextMenu(null);
  }, [contextMenu, handleContextMenuJumpTo, setContextMenu]);

  const handleContextMenuDuplicateWrapped = useCallback(() => {
    if (!contextMenu) return;
    handleContextMenuDuplicate(contextMenu.itemId);
    setContextMenu(null);
  }, [contextMenu, handleContextMenuDuplicate, setContextMenu]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!focusedItemId) return;
      const currentIndex = timeline.findIndex(
        (item) => item.id === focusedItemId,
      );
      if (currentIndex === -1) return;

      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          openDraftFromItemId(focusedItemId);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          event.preventDefault();
          onDelete([focusedItemId]);
          if (currentIndex < timeline.length - 1) {
            setFocusedItemId(timeline[currentIndex + 1].id);
            onSelectionChange([timeline[currentIndex + 1].id]);
          } else if (currentIndex > 0) {
            setFocusedItemId(timeline[currentIndex - 1].id);
            onSelectionChange([timeline[currentIndex - 1].id]);
          } else {
            setFocusedItemId(null);
          }
          break;
        }
        default:
          break;
      }
    },
    [
      focusedItemId,
      timeline,
      onSelectionChange,
      onDelete,
      openDraftFromItemId,
      setFocusedItemId,
    ],
  );

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
    handleKeyDown,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
  };
};
