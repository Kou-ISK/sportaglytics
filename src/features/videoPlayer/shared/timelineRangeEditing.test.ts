import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../../types/timeline/core';
import { mergeTimelineItems, splitTimelineItem } from './timelineRangeEditing';

const first: TimelineData = {
  id: 'first',
  actionName: 'Scrum',
  startTime: 5,
  endTime: 15,
  memo: '最初のメモ',
  labels: [{ group: 'Result', name: 'Success' }],
  color: '#123456',
};
const second: TimelineData = {
  ...first,
  id: 'second',
  startTime: 18,
  endTime: 25,
  memo: '追加のメモ',
  labels: [...(first.labels ?? []), { group: 'Type', name: 'Attack' }],
};

describe('timeline range edits', () => {
  it('splits without losing metadata or changing unrelated entries', () => {
    const input = [first, second];
    const result = splitTimelineItem(input, 'first', 10, 'right');
    expect(result).toEqual([
      { ...first, endTime: 10 },
      { ...first, id: 'right', startTime: 10 },
      second,
    ]);
    expect(result[1].labels).not.toBe(first.labels);
    expect(result[2]).toBe(second);
    expect(input).toEqual([first, second]);
  });
  it('ignores endpoints, invalid times, missing IDs and ID collisions', () => {
    const input = [first];
    for (const time of [0, 5, 15, 20, NaN, Infinity])
      expect(splitTimelineItem(input, 'first', time, 'right')).toBe(input);
    expect(splitTimelineItem(input, 'missing', 10, 'right')).toBe(input);
    expect(splitTimelineItem(input, 'first', 10, 'first')).toBe(input);
  });
  it('merges the whole span, preserves the earliest ID and combines distinct notes/labels', () => {
    const untouched = { ...first, id: 'other', actionName: 'Lineout' };
    const result = mergeTimelineItems(
      [second, untouched, first],
      ['second', 'first'],
    );
    expect(result).toEqual([
      untouched,
      {
        ...first,
        endTime: 25,
        memo: '最初のメモ\n\n追加のメモ',
        labels: second.labels,
      },
    ]);
    expect(result[1].labels).not.toBe(second.labels);
    expect(first.endTime).toBe(15);
  });
  it('deduplicates equal metadata and refuses cross-row or stale selections', () => {
    const input = [
      first,
      { ...first, id: 'duplicate' },
      { ...second, actionName: 'Lineout' },
    ];
    expect(mergeTimelineItems(input, ['first', 'duplicate'])[0]).toEqual(first);
    for (const ids of [
      ['first'],
      ['first', 'first'],
      ['first', 'second'],
      ['first', 'missing', 'duplicate'],
    ])
      expect(mergeTimelineItems(input, ids)).toBe(input);
  });
});
