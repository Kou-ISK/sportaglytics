import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../types/timeline/core';
import {
  extractUniqueGroups,
  getLabelByGroup,
  getLabelsFromTimelineData,
} from './labelExtractors';
import { normalizeTimelineData } from './scTimelineConverter';

describe('timeline label group migration', () => {
  it('migrates legacy action groups to Result and Type at load time', () => {
    const normalized = normalizeTimelineData({
      id: 'entry-1',
      actionName: 'TeamA Scrum',
      startTime: 0,
      endTime: 5,
      memo: '',
      actionType: 'Good',
      actionResult: 'Won',
      labels: [
        { group: 'actionType', name: 'Kick' },
        { group: 'actionResult', name: 'Lost' },
      ],
    });

    expect(normalized.labels).toEqual([
      { group: 'Type', name: 'Kick' },
      { group: 'Result', name: 'Lost' },
      { group: 'Type', name: 'Good' },
      { group: 'Result', name: 'Won' },
    ]);
  });

  it('does not treat Result and actionResult as the same group', () => {
    const timeline: TimelineData[] = [
      {
        id: 'entry-1',
        actionName: 'TeamA Scrum',
        startTime: 0,
        endTime: 5,
        memo: '',
        labels: [
          { group: 'Result', name: 'Won' },
          { group: 'actionResult', name: 'Legacy Won' },
          { group: 'Type', name: 'Positive' },
          { group: 'actionType', name: 'Legacy Positive' },
        ],
      },
    ];

    expect(getLabelByGroup(timeline[0], 'Result')).toBe('Won');
    expect(getLabelByGroup(timeline[0], 'actionResult')).toBeUndefined();
    expect(extractUniqueGroups(timeline)).toEqual(['Result', 'Type']);
    expect(getLabelsFromTimelineData(timeline[0])).toEqual([
      { group: 'Result', name: 'Won' },
      { group: 'Result', name: 'Legacy Won' },
      { group: 'Type', name: 'Positive' },
      { group: 'Type', name: 'Legacy Positive' },
    ]);
  });
});
