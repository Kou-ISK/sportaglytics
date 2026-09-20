import { useCallback, useRef } from 'react';
import type React from 'react';
import type { VisualTimelineProps } from '../VisualTimeline.types';
import type { TimelineRowInteractions } from './useTimelineRowInteractions';

interface Params extends Pick<
  VisualTimelineProps,
  | 'timeline'
  | 'rows'
  | 'onDelete'
  | 'onSelectionChange'
  | 'onPasteTimelineItemsToRow'
> {
  rowInteractions: TimelineRowInteractions;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  focusedItemId: string | null;
  hoveredItemId: string | null;
  contextMenu: { itemId: string } | null;
  setFocusedItemId: (id: string | null) => void;
  setHoveredItemId: (id: string | null) => void;
  handleCloseContextMenu: () => void;
  info: (message: string) => void;
}
interface Commands {
  handleCopyTimelineItems: (items: VisualTimelineProps['timeline']) => void;
  handlePasteTimelineItems: (rowId: string) => void;
  handleDeleteSelectedItems: (ids: string[]) => void;
  clearSelection: () => void;
  selectAllItems: () => void;
}

export const useTimelineInstanceCommands = ({
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
}: Params): Commands => {
  const copiedItemsRef = useRef<typeof timeline>([]);
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
      // Detached Timeline receives the new IDs asynchronously from its owner.
      // Do not overwrite that selection with an empty command.
      if (pastedIds.length > 0) onSelectionChange(pastedIds);
      rowInteractions.clearRowSelection();
      scrollContainerRef.current?.focus({ preventScroll: true });
      info(
        pastedIds.length > 0
          ? `${pastedIds.length}件のインスタンスを貼り付けました`
          : `${copiedItems.length}件のインスタンスを貼り付けます`,
      );
    },
    [
      info,
      onPasteTimelineItemsToRow,
      onSelectionChange,
      rowInteractions,
      scrollContainerRef,
    ],
  );

  const handleDeleteSelectedItems = useCallback(
    (ids: string[]): void => {
      if (ids.length === 0) return;
      const deletedIds = new Set(ids);
      onDelete(ids);
      scrollContainerRef.current?.focus({ preventScroll: true });
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
      scrollContainerRef,
    ],
  );

  const clearSelection = (): void => {
    onSelectionChange([]);
    setFocusedItemId(null);
    setHoveredItemId(null);
    rowInteractions.clearRowSelection();
  };
  const selectAllItems = (): void => {
    const names = new Set(
      rows
        .filter((row) => rowInteractions.selectedRowIds.includes(row.id))
        .map((row) => row.name),
    );
    onSelectionChange(
      timeline
        .filter((item) => names.size === 0 || names.has(item.actionName))
        .map((item) => item.id),
    );
    rowInteractions.clearRowSelection();
    rowInteractions.onCloseRowContextMenu();
    scrollContainerRef.current?.focus({ preventScroll: true });
  };

  return {
    handleCopyTimelineItems,
    handlePasteTimelineItems,
    handleDeleteSelectedItems,
    clearSelection,
    selectAllItems,
  };
};
