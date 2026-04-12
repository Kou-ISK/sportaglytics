import { useEffect } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';

interface UseTimelineGlobalShortcutsParams {
  selectedIds: string[];
  timeline: TimelineData[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (ids: string[]) => void;
  onSeek: (time: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useTimelineGlobalShortcuts = ({
  selectedIds,
  timeline,
  scrollContainerRef,
  onSelectionChange,
  onSeek,
  onUndo,
  onRedo,
}: UseTimelineGlobalShortcutsParams) => {
  useEffect(() => {
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
  ]);
};
