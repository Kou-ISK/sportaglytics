import { expect, it } from 'vitest';
import type { TimelineData } from '../../../types/timeline/core';
import { detectionProvenance } from '../../../shared/timeline/fixtures/detectionProvenance';
import { pasteTimelineItemsInRow } from './timelineRows';
import { mergeTimelineItems } from './timelineRangeEditing';

const detected: TimelineData = {
  id: 'detected',
  actionName: 'Scrum',
  startTime: 1,
  endTime: 6,
  memo: '',
  provenance: detectionProvenance,
};
const unknown: TimelineData = {
  id: 'unknown',
  actionName: 'Scrum',
  startTime: 7,
  endTime: 10,
  memo: '',
};

it('internal paste changes the destination without changing origin or review status', () => {
  const copied = pasteTimelineItemsInRow(
    [],
    [detected],
    { id: 'row', name: 'Review', color: '#123456' },
    ['copy'],
  )[0];
  expect(copied.actionName).toBe('Review');
  expect(copied.provenance).toEqual(detectionProvenance);
  expect(copied.provenance?.sources[0]).not.toBe(
    detected.provenance?.sources[0],
  );
});

it('combining known and unknown entries preserves both origins regardless of document order', () => {
  for (const entries of [
    [detected, unknown],
    [unknown, detected],
  ]) {
    const [merged] = mergeTimelineItems(entries, ['unknown', 'detected']);
    expect(merged.provenance).toEqual({
      ...detectionProvenance,
      hasUnknownSource: true,
    });
  }
  const firstUnknown = { ...unknown, startTime: 0, endTime: 1 };
  expect(
    mergeTimelineItems([firstUnknown, detected], ['unknown', 'detected'])[0]
      .provenance,
  ).toEqual({ ...detectionProvenance, hasUnknownSource: true });
});
