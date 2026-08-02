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

  it('round trips empty rows in version 2 documents', () => {
    const rows = [{ id: 'row-1', name: 'Empty row', color: '#abcdef' }];
    const serialized = serializeTimelineDocument([], rows);
    const parsed = parseTimelineDocument(serialized);

    expect(parsed.rows).toEqual(rows);
    expect(parsed.timeline).toEqual([]);
  });
});
