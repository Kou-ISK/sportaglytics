import { useEffect } from 'react';
import { shouldIgnoreHotkeyTarget } from '../../../../../../hooks/globalHotkeyUtils';
import type { TimelineData } from '../../../../../../types/timeline/core';

interface UseTimelineGlobalShortcutsParams {
  selectedIds: string[];
  timeline: TimelineData[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (ids: string[]) => void;
  onFocusItemChange?: (id: string) => void;
  onSeek: (time: number) => void;
  onSplit?: () => void;
  onMerge?: () => void;
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
  onFocusItemChange,
  onSeek,
  onSplit,
  onMerge,
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
      if (
        command &&
        event.shiftKey &&
        ['k', 'j'].includes(event.key.toLowerCase())
      ) {
        const run = event.key.toLowerCase() === 'k' ? onSplit : onMerge;
        event.preventDefault();
        event.stopPropagation();
        if (run && !event.repeat) run();
        return;
      }
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

      const isTabActionTarget =
        target === scrollContainerRef.current ||
        Boolean(target?.closest('[data-timeline-item-id]'));
      const isTabJump =
        event.key === 'Tab' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isTabActionTarget;
      const isJumpNext =
        (isTabJump && !event.shiftKey) ||
        (event.altKey && event.key === 'ArrowDown');
      const isJumpPrev =
        (isTabJump && event.shiftKey) ||
        (event.altKey && event.key === 'ArrowUp');

      if (isJumpNext || isJumpPrev) {
        if (event.isComposing || selectedIds.length === 0) return;
        const items = [...timeline].sort((a, b) => a.startTime - b.startTime);
        const current = items.find((item) => selectedIds.includes(item.id));
        if (!current) return;

        const sameActionItems = items.filter(
          (item) => item.actionName === current.actionName,
        );
        const currentIndex = sameActionItems.findIndex(
          (item) => item.id === current.id,
        );
        const direction: 1 | -1 = isJumpPrev ? -1 : 1;
        const nextIndex =
          (currentIndex + direction + sameActionItems.length) %
          sameActionItems.length;
        const targetItem = sameActionItems[nextIndex];
        if (!targetItem) return;

        event.preventDefault();
        event.stopPropagation();
        onSelectionChange([targetItem.id]);
        onFocusItemChange?.(targetItem.id);
        onSeek(targetItem.startTime);
        const container = scrollContainerRef.current;
        const nextElement = Array.from(
          container?.querySelectorAll<HTMLElement>('[data-timeline-item-id]') ??
            [],
        ).find((element) => element.dataset.timelineItemId === targetItem.id);
        (nextElement ?? container)?.focus({ preventScroll: true });
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
    onFocusItemChange,
    onUndo,
    onSplit,
    onMerge,
    scrollContainerRef,
    selectedIds,
    selectedRowIds,
    timeline,
  ]);
};
