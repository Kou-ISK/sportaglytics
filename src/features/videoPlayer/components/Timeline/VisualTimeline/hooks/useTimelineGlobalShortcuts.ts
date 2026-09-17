import { useEffect } from 'react';
import { shouldIgnoreHotkeyTarget } from '../../../../../../hooks/globalHotkeyUtils';
import type { TimelineData } from '../../../../../../types/timeline/core';

interface UseTimelineGlobalShortcutsParams {
  selectedIds: string[];
  timeline: TimelineData[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (ids: string[]) => void;
  onSeek: (time: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAddToPlaylist?: (items: TimelineData[]) => void;
  selectedRowIds: string[];
  onCopyItems?: (items: TimelineData[]) => void;
  onPasteItems?: (targetRowId: string) => void;
  onEditItem?: (id: string) => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onDeleteItems?: (ids: string[]) => void;
  onRequestDeleteRows?: (ids?: string[]) => void;
}

const isDialogTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && Boolean(target.closest('[role="dialog"]'));

export const useTimelineGlobalShortcuts = ({
  selectedIds,
  timeline,
  scrollContainerRef,
  onSelectionChange,
  onSeek,
  onUndo,
  onRedo,
  onAddToPlaylist,
  selectedRowIds,
  onCopyItems,
  onPasteItems,
  onEditItem,
  onClearSelection,
  onSelectAll,
  onDeleteItems,
  onRequestDeleteRows,
}: UseTimelineGlobalShortcutsParams): void => {
  useEffect(() => {
    const handleKeyDownGlobal = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTimelineRowHeader = Boolean(
        target?.closest('[data-testid^="timeline-row-header-"]'),
      );
      const isButton = target?.tagName.toLowerCase() === 'button';
      const shouldIgnore =
        shouldIgnoreHotkeyTarget(target) ||
        isDialogTarget(target) ||
        (isButton && !isTimelineRowHeader);
      const isInsideTimeline =
        Boolean(scrollContainerRef.current) &&
        target instanceof Node &&
        Boolean(scrollContainerRef.current?.contains(target));

      if (!isInsideTimeline || shouldIgnore || event.defaultPrevented) return;

      const command = (event.metaKey || event.ctrlKey) && !event.altKey;
      if (event.key === 'Escape' && onClearSelection) {
        event.preventDefault();
        event.stopPropagation();
        onClearSelection();
        return;
      }
      if (
        command &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'a' &&
        onSelectAll
      ) {
        event.preventDefault();
        event.stopPropagation();
        onSelectAll();
        return;
      }
      if (
        event.key === 'Enter' &&
        !command &&
        !event.altKey &&
        !event.shiftKey &&
        !isTimelineRowHeader &&
        onEditItem
      ) {
        const focusedId = target
          ?.closest('[data-timeline-item-id]')
          ?.getAttribute('data-timeline-item-id');
        const id =
          focusedId ?? (selectedIds.length === 1 ? selectedIds[0] : undefined);
        if (id && timeline.some((item) => item.id === id)) {
          event.preventDefault();
          event.stopPropagation();
          onEditItem(id);
        }
        return;
      }

      if (command && !event.shiftKey && event.key.toLowerCase() === 'c') {
        const selectedItems = timeline.filter((item) =>
          selectedIds.includes(item.id),
        );
        if (selectedItems.length > 0 && onCopyItems) {
          event.preventDefault();
          event.stopPropagation();
          onCopyItems(selectedItems);
        }
        return;
      }

      if (command && !event.shiftKey && event.key.toLowerCase() === 'v') {
        const targetRowId = selectedRowIds.length === 1 && selectedRowIds[0];
        if (targetRowId && onPasteItems) {
          event.preventDefault();
          event.stopPropagation();
          onPasteItems(targetRowId);
        }
        return;
      }

      const isPlainDelete =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key === 'Delete' || event.key === 'Backspace');

      if (isPlainDelete) {
        if (selectedRowIds.length > 0 && onRequestDeleteRows) {
          event.preventDefault();
          event.stopPropagation();
          onRequestDeleteRows(selectedRowIds);
          return;
        }
        if (selectedIds.length > 0 && onDeleteItems) {
          event.preventDefault();
          event.stopPropagation();
          onDeleteItems([...selectedIds]);
          return;
        }
      }

      const isJumpNext =
        event.key === 'Tab' || (event.altKey && event.key === 'ArrowDown');
      const isJumpPrev =
        (event.key === 'Tab' && event.shiftKey) ||
        (event.altKey && event.key === 'ArrowUp');

      if (isJumpNext || isJumpPrev) {
        if (selectedIds.length === 0) return;
        if (event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
        }

        if (selectedIds.length > 0) {
          if (event.altKey) {
            event.preventDefault();
            event.stopPropagation();
          }

          const items = [...timeline].sort((a, b) => a.startTime - b.startTime);
          const current = items.find((item) => selectedIds.includes(item.id));
          if (!current) return;

          const sameActionItems = items.filter(
            (item) => item.actionName === current.actionName,
          );
          const currentIndex = sameActionItems.findIndex(
            (item) => item.id === current.id,
          );
          if (currentIndex === -1) return;

          const direction: 1 | -1 = isJumpPrev ? -1 : 1;
          const nextIndex =
            (currentIndex + direction + sameActionItems.length) %
            Math.max(sameActionItems.length, 1);
          const targetItem = sameActionItems[nextIndex];
          if (!targetItem) return;

          onSelectionChange([targetItem.id]);
          onSeek(targetItem.startTime);
        }
        return;
      }

      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }

      if (command && event.shiftKey && event.key.toLowerCase() === 'p') {
        const selectedItems = timeline.filter((item) =>
          selectedIds.includes(item.id),
        );
        if (selectedItems.length === 0 || !onAddToPlaylist) return;
        event.preventDefault();
        event.stopPropagation();
        onAddToPlaylist(selectedItems);
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal, true);
    return () =>
      window.removeEventListener('keydown', handleKeyDownGlobal, true);
  }, [
    onAddToPlaylist,
    onCopyItems,
    onDeleteItems,
    onEditItem,
    onClearSelection,
    onSelectAll,
    onPasteItems,
    onRedo,
    onRequestDeleteRows,
    onSeek,
    onSelectionChange,
    onUndo,
    scrollContainerRef,
    selectedIds,
    selectedRowIds,
    timeline,
  ]);
};
