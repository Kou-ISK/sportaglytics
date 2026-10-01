import { describe, expect, it } from 'vitest';
import {
  parseTimelineDocument,
  serializeTimelineDocument,
} from './timelineDocument';

describe('timelineDocument', () => {
  it('loads the legacy array format and derives row metadata', () => {
    const parsed = parseTimelineDocument(
      JSON.stringify([
        {
          id: 'instance-1',
          actionName: 'Attack',
          startTime: 1,
          endTime: 2,
          memo: '',
          color: '#123456',
        },
      ]),
    );

    expect(parsed.timeline).toHaveLength(1);
    expect(parsed.rows).toEqual([
      { id: 'legacy-row-1', name: 'Attack', color: '#123456' },
    ]);
  });

  it('preserves v2 group identity, duplicate text, special dictionary keys and order through save/reopen', () => {
    const labels = [
      { name: 'same', group: 'actionType' },
      { name: 'same', group: 'Type' },
      { name: 'first', group: '__proto__' },
      { name: 'second', group: '__proto__' },
      { name: 'third', group: 'constructor' },
      { name: 'fourth', group: 'toString' },
      { name: 'empty group', group: '' },
      { name: 'no group' },
    ];
    const rows = [{ id: 'r', name: 'Attack', color: '#123456' }];
    const instances = [
      {
        id: 'i',
        actionName: 'Attack',
        startTime: 1.25,
        endTime: 2.5,
        memo: 'original',
        labels,
      },
    ];
    const parsed = parseTimelineDocument(
      JSON.stringify({ version: 2, rows, instances }),
    );
    expect(parsed.timeline[0].labels).toEqual(labels);
    const saved = serializeTimelineDocument(
      [{ ...parsed.timeline[0], memo: 'edited' }],
      parsed.rows,
    );
    expect(parseTimelineDocument(saved).timeline[0].labels).toEqual(labels);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it('round trips empty rows in version 2 documents', () => {
    const rows = [{ id: 'row-1', name: 'Empty row', color: '#abcdef' }];
    const serialized = serializeTimelineDocument([], rows);
    const parsed = parseTimelineDocument(serialized);

    expect(parsed.rows).toEqual(rows);
    expect(parsed.timeline).toEqual([]);
  });
});
