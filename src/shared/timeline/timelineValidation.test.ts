import { expect, it } from 'vitest';
import { validateTimelineDocumentData } from './timelineValidation';

const entry = {
  id: 'one',
  actionName: 'Attack',
  startTime: 1.123456789,
  endTime: 2.25,
  memo: '日本語 🏉',
};
it('accepts known legacy arrays and current empty rows without changing content', () => {
  const legacy = [entry];
  const before = JSON.stringify(legacy);
  expect(() => validateTimelineDocumentData(legacy)).not.toThrow();
  expect(JSON.stringify(legacy)).toBe(before);
  expect(() =>
    validateTimelineDocumentData({ version: 2, rows: [], instances: [] }),
  ).not.toThrow();
});
it.each([
  null,
  {},
  { version: 99, rows: [], instances: [] },
  { version: 2, instances: [] },
  [{ ...entry, startTime: -1 }],
  [{ ...entry, endTime: 0 }],
  [{ ...entry, startTime: Infinity }],
  [entry, entry],
  [{ ...entry, labels: [{ group: 'Result' }] }],
])(
  'rejects unsupported or corrupt documents rather than treating them as empty: %j',
  (value) => {
    expect(() => validateTimelineDocumentData(value)).toThrow();
  },
);
