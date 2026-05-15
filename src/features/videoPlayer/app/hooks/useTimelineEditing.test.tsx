/* @vitest-environment jsdom */

import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../../../types/timeline/core';
import {
  duplicateTimelineItemInList,
  useTimelineEditing,
} from './useTimelineEditing';

const sourceTimelineItem: TimelineData = {
  id: 'timeline-1',
  actionName: 'Alpha - Try',
  startTime: 12,
  endTime: 18,
  memo: 'memo',
  labels: [{ name: 'Try', group: 'actionType' }],
  color: '#123456',
};

describe('duplicateTimelineItemInList', () => {
  it('inserts a copied timeline item directly after the source item', () => {
    const nextItem: TimelineData = {
      id: 'timeline-2',
      actionName: 'Beta - Tackle',
      startTime: 20,
      endTime: 23,
      memo: '',
    };

    const result = duplicateTimelineItemInList(
      [sourceTimelineItem, nextItem],
      sourceTimelineItem.id,
      'duplicate-1',
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(sourceTimelineItem);
    expect(result[1]).toEqual({
      ...sourceTimelineItem,
      id: 'duplicate-1',
    });
    expect(result[1]?.labels).toEqual(sourceTimelineItem.labels);
    expect(result[1]?.labels).not.toBe(sourceTimelineItem.labels);
    expect(result[2]).toBe(nextItem);
  });

  it('returns the original timeline when the source item does not exist', () => {
    const timeline = [sourceTimelineItem];

    const result = duplicateTimelineItemInList(
      timeline,
      'missing',
      'duplicate-1',
    );

    expect(result).toBe(timeline);
  });
});

describe('useTimelineEditing', () => {
  it('duplicates an existing item and returns the duplicate id', () => {
    const { result } = renderHook(() => {
      const [timeline, setTimeline] = useState<TimelineData[]>([
        sourceTimelineItem,
      ]);
      return {
        timeline,
        ...useTimelineEditing(setTimeline),
      };
    });

    let duplicateId: string | null = null;

    act(() => {
      duplicateId = result.current.duplicateTimelineItem(sourceTimelineItem.id);
    });

    expect(duplicateId).toEqual(expect.any(String));
    expect(duplicateId).not.toBe(sourceTimelineItem.id);
    expect(result.current.timeline).toHaveLength(2);
    expect(result.current.timeline[1]).toEqual({
      ...sourceTimelineItem,
      id: duplicateId,
    });
  });
});
