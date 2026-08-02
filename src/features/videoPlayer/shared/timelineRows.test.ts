import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../../types/timeline/core';
import {
  buildTimelineRowMoveUpdates,
  deriveTimelineRows,
  ensureTimelineRows,
  moveTimelineRowInList,
  pasteTimelineItemsInRow,
} from './timelineRows';

const item = (
  id: string,
  actionName: string,
  color?: string,
): TimelineData => ({
  id,
  actionName,
  startTime: 0,
  endTime: 1,
  memo: '',
  ...(color ? { color } : {}),
});

describe('timelineRows', () => {
  it('derives one row per action and adopts the first instance color', () => {
    const rows = deriveTimelineRows([
      item('1', 'Attack', '#123456'),
      item('2', 'Attack', '#abcdef'),
      item('3', 'Defence'),
    ]);

    expect(rows.map((row) => row.name)).toEqual(['Attack', 'Defence']);
    expect(rows[0]?.color).toBe('#123456');
  });

  it('keeps empty configured rows and appends only missing action rows', () => {
    const configured = [{ id: 'empty', name: 'Empty', color: '#111111' }];
    const rows = ensureTimelineRows(configured, [item('1', 'Attack')]);

    expect(rows.map((row) => row.name)).toEqual(['Empty', 'Attack']);
    expect(ensureTimelineRows(rows, [item('1', 'Attack')])).toBe(rows);
  });

  it('changes a moved instance to the destination row color', () => {
    const updates = buildTimelineRowMoveUpdates(
      [{ id: 'row-1', name: 'Defence', color: '#00ff00' }],
      'Defence',
    );

    expect(updates).toEqual({ actionName: 'Defence', color: '#00ff00' });
  });

  it('reorders rows by dropping the source at the target position', () => {
    const rows = [
      { id: 'a', name: 'A', color: '#111111' },
      { id: 'b', name: 'B', color: '#222222' },
      { id: 'c', name: 'C', color: '#333333' },
    ];

    expect(moveTimelineRowInList(rows, 'c', 'a').map((row) => row.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('pastes copied instances into the selected row at their original times', () => {
    const source = {
      ...item('source', 'Attack', '#ff0000'),
      startTime: 12,
      endTime: 18,
      labels: [{ name: 'Turnover', group: 'Result' }],
    };
    const result = pasteTimelineItemsInRow(
      [source],
      [source],
      { id: 'defence', name: 'Defence', color: '#00ff00' },
      ['pasted'],
    );

    expect(result[1]).toMatchObject({
      id: 'pasted',
      actionName: 'Defence',
      color: '#00ff00',
      startTime: 12,
      endTime: 18,
    });
    expect(result[1]?.labels).not.toBe(source.labels);
  });
});
