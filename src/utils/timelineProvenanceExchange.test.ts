import { expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from './timelineExport';
import {
  convertFromSCTimeline,
  convertToSCTimeline,
} from './scTimelineConverter';
import { detectionProvenance } from '../shared/timeline/fixtures/detectionProvenance';
import type { TimelineData } from '../types/timeline/core';

const item: TimelineData = {
  id: 'one',
  actionName: 'Scrum',
  startTime: 0,
  endTime: 5,
  memo: '',
  provenance: detectionProvenance,
};
it('preserves source metadata through the native instance-array JSON exchange', () => {
  expect(importFromJSON(exportToJSON([item]))[0].provenance).toEqual(
    detectionProvenance,
  );
});
it('does not invent review or origin when importing SCTimeline exchange data', () => {
  expect(
    convertFromSCTimeline(convertToSCTimeline([item]))[0].provenance,
  ).toBeUndefined();
});
