import { describe, expect, it } from 'vitest';
import { buildSelectionLabelUpdates } from './applyLabelsToTimelineSelection';

describe('buildSelectionLabelUpdates', () => {
  it('adds only missing labels to selected items', () => {
    const updates = buildSelectionLabelUpdates(
      [
        {
          id: 'item-1',
          actionName: 'TeamA Pass',
          startTime: 0,
          endTime: 1,
          memo: '',
          labels: [{ name: 'existing', group: 'tag' }],
        },
      ],
      ['item-1'],
      [
        { name: 'existing', group: 'tag' },
        { name: 'new', group: 'tag' },
      ],
    );

    expect(updates).toEqual([
      {
        id: 'item-1',
        labels: [
          { name: 'existing', group: 'tag' },
          { name: 'new', group: 'tag' },
        ],
      },
    ]);
  });
});
