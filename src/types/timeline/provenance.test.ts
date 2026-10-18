import { expect, it } from 'vitest';
import { isTimelineProvenance } from './provenance';
import { detectionProvenance } from '../../shared/timeline/fixtures/detectionProvenance';

const withSource = (changes: Record<string, unknown>): unknown => ({
  ...detectionProvenance,
  sources: [{ ...detectionProvenance.sources[0], ...changes }],
});

it.each([0, 1])(
  'accepts inclusive score bounds %s and zero time without inferring human review',
  (confidence) => {
    expect(
      isTimelineProvenance(withSource({ confidence, anchorTime: 0 })),
    ).toBe(true);
  },
);
it.each([
  -0.01,
  1.01,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  '0.9',
  null,
])('rejects invalid confidence %s', (confidence) => {
  expect(isTimelineProvenance(withSource({ confidence }))).toBe(false);
});
it.each([
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  '1',
  null,
])('rejects invalid source time %s', (anchorTime) => {
  expect(isTimelineProvenance(withSource({ anchorTime }))).toBe(false);
});
it.each(['requestId', 'modelId', 'modelVersion', 'candidateId', 'eventType'])(
  'requires a recorded nonempty %s',
  (field) => {
    for (const value of ['', '  ', null, 1]) {
      expect(isTimelineProvenance(withSource({ [field]: value }))).toBe(false);
    }
  },
);
it('rejects an empty or malformed source list and nonboolean unknown-source flags', () => {
  for (const sources of [[], [null], {}, null]) {
    expect(isTimelineProvenance({ ...detectionProvenance, sources })).toBe(
      false,
    );
  }
  for (const hasUnknownSource of [undefined, null, 'false', 0]) {
    expect(
      isTimelineProvenance({ ...detectionProvenance, hasUnknownSource }),
    ).toBe(false);
  }
});
