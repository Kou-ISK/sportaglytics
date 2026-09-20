import { useCallback } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ulid } from 'ulid';
import type { TimelineData } from '../../../../types/timeline/core';
import {
  getMergeableTimelineItems,
  mergeTimelineItems,
  splitTimelineItem,
} from '../../shared/timelineRangeEditing';

export interface TimelineRangeEditing {
  splitTimelineItem: (id: string, time: number) => void;
  mergeTimelineItems: (ids: string[]) => void;
}

export const useTimelineRangeEditing = (
  timelineRef: RefObject<TimelineData[]>,
  setTimeline: Dispatch<SetStateAction<TimelineData[]>>,
  select: (ids: string[]) => void,
): TimelineRangeEditing => {
  const split = useCallback(
    (id: string, time: number): void => {
      const rightId = ulid();
      const previous = timelineRef.current;
      const next = splitTimelineItem(previous, id, time, rightId);
      if (next === previous) return;
      // A complete edit is committed once, so Undo never exposes a half-split range.
      setTimeline(next);
      select([id, rightId]);
    },
    [timelineRef, setTimeline, select],
  );
  const merge = useCallback(
    (ids: string[]): void => {
      const previous = timelineRef.current;
      const items = getMergeableTimelineItems(previous, ids);
      if (items.length === 0) return;
      setTimeline(mergeTimelineItems(previous, ids));
      select([items[0].id]);
    },
    [timelineRef, setTimeline, select],
  );
  return { splitTimelineItem: split, mergeTimelineItems: merge };
};
