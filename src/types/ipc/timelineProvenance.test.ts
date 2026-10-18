import { expect, it } from 'vitest';
import { isTimelineData } from './analysisWindow';
import { isTimelineWindowCommand } from './timelineWindow';
import { detectionProvenance } from '../../shared/timeline/fixtures/detectionProvenance';

const item = {
  id: 'one',
  actionName: 'Scrum',
  startTime: 0,
  endTime: 5,
  memo: '',
};
it('accepts legacy and validated source metadata through internal paste and analysis IPC', () => {
  for (const value of [item, { ...item, provenance: detectionProvenance }]) {
    expect(isTimelineData(value)).toBe(true);
    expect(
      isTimelineWindowCommand({
        type: 'paste-items',
        items: [value],
        targetRowId: 'row',
      }),
    ).toBe(true);
  }
});
it.each([
  null,
  {},
  { ...detectionProvenance, reviewStatus: 'human-confirmed' },
])('rejects unsupported source metadata through IPC (%j)', (provenance) => {
  const value = { ...item, provenance };
  expect(isTimelineData(value)).toBe(false);
  expect(
    isTimelineWindowCommand({
      type: 'paste-items',
      items: [value],
      targetRowId: 'row',
    }),
  ).toBe(false);
});
it('does not permit editing provenance via ordinary update commands', () => {
  expect(
    isTimelineWindowCommand({
      type: 'update-item',
      id: 'one',
      updates: { provenance: detectionProvenance },
    }),
  ).toBe(false);
});
