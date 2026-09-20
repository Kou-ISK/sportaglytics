import type { RefObject } from 'react';
import type { VisualTimelineProps } from '../VisualTimeline.types';
import {
  canSplitTimelineItem,
  getMergeableTimelineItems,
} from '../../../../shared/timelineRangeEditing';

interface Params extends Pick<
  VisualTimelineProps,
  | 'timeline'
  | 'selectedIds'
  | 'currentTime'
  | 'onSplitTimelineItem'
  | 'onMergeTimelineItems'
> {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}
interface Commands {
  canSplit: boolean;
  canMerge: boolean;
  split: () => void;
  merge: () => void;
}

export const useTimelineRangeCommands = ({
  timeline,
  selectedIds,
  currentTime,
  onSplitTimelineItem,
  onMergeTimelineItems,
  scrollContainerRef,
}: Params): Commands => {
  const item =
    selectedIds.length === 1
      ? timeline.find((entry) => entry.id === selectedIds[0])
      : undefined;
  const canSplit =
    Boolean(onSplitTimelineItem) && canSplitTimelineItem(item, currentTime);
  const canMerge =
    Boolean(onMergeTimelineItems) &&
    getMergeableTimelineItems(timeline, selectedIds).length > 0;
  const focusTimeline = (): void => {
    // The context menu restores focus as it closes; restore the editing target afterwards.
    requestAnimationFrame(() =>
      scrollContainerRef.current?.focus({ preventScroll: true }),
    );
  };
  return {
    canSplit,
    canMerge,
    split: (): void => {
      if (!canSplit || !item) return;
      onSplitTimelineItem?.(item.id, currentTime);
      focusTimeline();
    },
    merge: (): void => {
      if (!canMerge) return;
      onMergeTimelineItems?.(selectedIds);
      focusTimeline();
    },
  };
};
