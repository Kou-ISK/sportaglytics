import { expect, it } from 'vitest';
import {
  mergeTimelineProvenance,
  parseTimelineProvenance,
} from './timelineProvenance';
import { detectionProvenance } from './fixtures/detectionProvenance';

it('merges all detector sources without representing unknown spans as detected', () => {
  const second = {
    ...detectionProvenance,
    sources: [
      {
        ...detectionProvenance.sources[0],
        candidateId: 'second',
        confidence: 0.8,
        anchorTime: 8,
      },
    ],
  };
  const merged = mergeTimelineProvenance([
    { provenance: detectionProvenance },
    { provenance: second },
    {},
  ]);
  expect(merged).toEqual({
    reviewStatus: 'unreviewed',
    hasUnknownSource: true,
    sources: [...detectionProvenance.sources, ...second.sources],
  });
  expect(
    mergeTimelineProvenance([
      { provenance: merged },
      { provenance: detectionProvenance },
    ]),
  ).toEqual(merged);
});

it('does not invent provenance for an all-legacy/manual merge', () => {
  expect(mergeTimelineProvenance([{}, {}])).toBeUndefined();
  expect(parseTimelineProvenance(undefined)).toBeUndefined();
});
