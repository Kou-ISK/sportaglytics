import { useCallback, useState } from 'react';
import { TimelineData } from '../../../../../../types/TimelineData';
import { TimelineEditDraft } from '../TimelineEditDialog';

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
  onUpdateQualifier?: (id: string, qualifier: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
}

export const useTimelineInteractions = ({
  timeline,
  selectedIds,
  onSelectionChange,
  onSeek,
  onDelete,
  onUpdateTimelineItem,
  onUpdateQualifier,
  onUpdateTimeRange,
}: UseTimelineInteractionsParams) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TimelineEditDraft | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    position: { top: number; left: number };
    itemId: string;
  } | null>(null);

  const handleItemClick = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.stopPropagation();

      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        if (selectedIds.includes(id)) {
          onSelectionChange(
            selectedIds.filter((selectedId) => selectedId !== id),
          );
        } else {
          onSelectionChange([...selectedIds, id]);
        }
        return;
      }

      const item = timeline.find((entry) => entry.id === id);
      if (!item) return;
      onSelectionChange([id]);
      onSeek(item.startTime);
    },
    [onSeek, onSelectionChange, selectedIds, timeline],
  );

  const handleItemContextMenu = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        position: { top: event.clientY, left: event.clientX },
        itemId: id,
      });

      if (!selectedIds.includes(id)) {
        onSelectionChange([id]);
      }
    },
    [selectedIds, onSelectionChange],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenu) return;
    const item = timeline.find((entry) => entry.id === contextMenu.itemId);
    if (!item) return;

    setEditingDraft({
      id: item.id,
      actionName: item.actionName,
      qualifier: item.qualifier || '',
      labels: item.labels || [],
      startTime: item.startTime.toString(),
      endTime: item.endTime.toString(),
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
    });
    setContextMenu(null);
  }, [contextMenu, timeline]);

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    onDelete([contextMenu.itemId]);
    setContextMenu(null);
  }, [contextMenu, onDelete]);

  const handleContextMenuJumpTo = useCallback(() => {
    if (!contextMenu) return;
    const item = timeline.find((entry) => entry.id === contextMenu.itemId);
    if (!item) return;
    onSeek(item.startTime);
    setContextMenu(null);
  }, [contextMenu, timeline, onSeek]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (!contextMenu) return;
    const item = timeline.find((entry) => entry.id === contextMenu.itemId);
    if (!item) return;
    // 複製機能は未実装。ログのみ残す。
    console.log('Duplicate item:', item);
    setContextMenu(null);
  }, [contextMenu, timeline]);

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
          const item = timeline[currentIndex];
          setEditingDraft({
            id: item.id,
            actionName: item.actionName,
            qualifier: item.qualifier || '',
            labels: item.labels || [],
            startTime: item.startTime.toString(),
            endTime: item.endTime.toString(),
            originalStartTime: item.startTime,
            originalEndTime: item.endTime,
          });
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
    [focusedItemId, timeline, onSelectionChange, onDelete],
  );

  const handleCloseDialog = useCallback(() => {
    setEditingDraft(null);
  }, []);

  const handleDialogChange = useCallback(
    (changes: Partial<TimelineEditDraft>) => {
      setEditingDraft((prev) => (prev ? { ...prev, ...changes } : prev));
    },
    [],
  );

  const handleDeleteSingle = useCallback(() => {
    if (!editingDraft) return;
    onDelete([editingDraft.id]);
    setEditingDraft(null);
  }, [editingDraft, onDelete]);

  const handleSaveDialog = useCallback(() => {
    if (!editingDraft) return;

    const parsedStart = Number(editingDraft.startTime);
    const parsedEnd = Number(editingDraft.endTime);

    const safeStart = Number.isFinite(parsedStart)
      ? Math.max(0, parsedStart)
      : editingDraft.originalStartTime;
    const safeEndSource = Number.isFinite(parsedEnd)
      ? parsedEnd
      : editingDraft.originalEndTime;
    const safeEnd = Math.max(safeStart, safeEndSource);

    console.debug('[VisualTimeline] Saving timeline edit:', {
      id: editingDraft.id,
      qualifier: editingDraft.qualifier,
      labels: editingDraft.labels,
      startTime: safeStart,
      endTime: safeEnd,
    });

    if (onUpdateTimelineItem) {
      console.debug(
        '[VisualTimeline] Using onUpdateTimelineItem for batch update',
      );
      onUpdateTimelineItem(editingDraft.id, {
        qualifier: editingDraft.qualifier,
        labels: editingDraft.labels,
        startTime: safeStart,
        endTime: safeEnd,
      });
    } else {
      if (onUpdateQualifier) {
        onUpdateQualifier(editingDraft.id, editingDraft.qualifier);
      }
      if (onUpdateTimeRange) {
        onUpdateTimeRange(editingDraft.id, safeStart, safeEnd);
      }
      console.warn(
        '[VisualTimeline] labels update requires onUpdateTimelineItem',
      );
    }

    setEditingDraft(null);
  }, [
    editingDraft,
    onUpdateQualifier,
    onUpdateTimeRange,
    onUpdateTimelineItem,
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
    handleContextMenuJumpTo,
    handleContextMenuDuplicate,
    handleKeyDown,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
  };
};
