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
  onDeleteItems,
  onRequestDeleteRows,
}: UseTimelineGlobalShortcutsParams) => {
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

      if (
        isInsideTimeline &&
        !shouldIgnore &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
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

      if (
        isInsideTimeline &&
        !shouldIgnore &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'v'
      ) {
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

      if (isInsideTimeline && !shouldIgnore && isPlainDelete) {
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

      if (
        isInsideTimeline &&
        !shouldIgnore &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }

      if (
        !shouldIgnore &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'p'
      ) {
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
    return () => window.removeEventListener('keydown', handleKeyDownGlobal, true);
  }, [
    onAddToPlaylist,
    onCopyItems,
    onDeleteItems,
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
