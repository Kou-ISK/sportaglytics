import { useEffect } from 'react';
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
  onRequestDeleteRows?: (ids?: string[]) => void;
}

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
  onRequestDeleteRows,
}: UseTimelineGlobalShortcutsParams) => {
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName?.toLowerCase();
      const isTimelineRowHeader = Boolean(
        target?.closest('[data-testid^="timeline-row-header-"]'),
      );
      const isFormElement =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (tag === 'button' && !isTimelineRowHeader);
      const isInsideTimeline =
        !!scrollContainerRef.current &&
        target instanceof Node &&
        scrollContainerRef.current.contains(target);

      if (
        isInsideTimeline &&
        !isFormElement &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'c'
      ) {
        const selectedItems = timeline.filter((item) =>
          selectedIds.includes(item.id),
        );
        if (selectedItems.length > 0 && onCopyItems) {
          e.preventDefault();
          e.stopPropagation();
          onCopyItems(selectedItems);
        }
        return;
      }

      if (
        isInsideTimeline &&
        !isFormElement &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'v'
      ) {
        const targetRowId = selectedRowIds.length === 1 && selectedRowIds[0];
        if (targetRowId && onPasteItems) {
          e.preventDefault();
          e.stopPropagation();
          onPasteItems(targetRowId);
        }
        return;
      }

      if (
        isInsideTimeline &&
        !isFormElement &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedRowIds.length > 0 &&
        onRequestDeleteRows
      ) {
        e.preventDefault();
        e.stopPropagation();
        onRequestDeleteRows(selectedRowIds);
        return;
      }

      const isJumpNext = e.key === 'Tab' || (e.altKey && e.key === 'ArrowDown');
      const isJumpPrev =
        (e.key === 'Tab' && e.shiftKey) || (e.altKey && e.key === 'ArrowUp');

      if (isJumpNext || isJumpPrev) {
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
        }

        if (selectedIds.length > 0) {
          if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
          }

          const items = [...timeline].sort((a, b) => a.startTime - b.startTime);
          const current = items.find((t) => selectedIds.includes(t.id));
          if (!current) return;

          const sameActionItems = items.filter(
            (t) => t.actionName === current.actionName,
          );
          const currentIndex = sameActionItems.findIndex(
            (t) => t.id === current.id,
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

      if (
        !isFormElement &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'p'
      ) {
        const selectedItems = timeline.filter((item) =>
          selectedIds.includes(item.id),
        );
        if (selectedItems.length === 0 || !onAddToPlaylist) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onAddToPlaylist(selectedItems);
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal, true);
    return () =>
      window.removeEventListener('keydown', handleKeyDownGlobal, true);
  }, [
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
    onRequestDeleteRows,
  ]);
};
