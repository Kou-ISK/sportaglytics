import { describe, expect, it } from 'vitest';
import { detectionProvenance } from '../../../../shared/timeline/fixtures/detectionProvenance';
import type { TimelineData } from '../../../../types/timeline/core';
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
    expect(parsed.timeline[0].provenance).toBeUndefined();
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

  const instance: TimelineData = {
    id: 'synthetic-item',
    actionName: 'Scrum',
    startTime: 1,
    endTime: 9,
    memo: '',
  };
  const rows = [{ id: 'synthetic-row', name: 'Scrum', color: '#123456' }];

  it('keeps legacy v2 data unknown and preserves new provenance through edits/save/reopen', () => {
    const old = parseTimelineDocument(
      serializeTimelineDocument([instance], rows),
    );
    expect(old.timeline[0].provenance).toBeUndefined();
    const created = { ...instance, provenance: detectionProvenance };
    const loaded = parseTimelineDocument(
      serializeTimelineDocument([created], rows),
    );
    const edited = {
      ...loaded.timeline[0],
      startTime: 2,
      memo: 'Edited by an analyst',
    };
    const reopened = parseTimelineDocument(
      serializeTimelineDocument([edited], rows),
    );
    expect(reopened.timeline[0].provenance).toEqual(detectionProvenance);
    expect(reopened.timeline[0].provenance?.reviewStatus).toBe('unreviewed');
    expect(reopened.timeline[0].provenance?.sources[0].anchorTime).toBe(4);
  });

  it.each([
    null,
    { ...detectionProvenance, reviewStatus: 'human-confirmed' },
    { ...detectionProvenance, hasUnknownSource: undefined },
    { ...detectionProvenance, sources: [] },
    {
      ...detectionProvenance,
      sources: [{ ...detectionProvenance.sources[0], modelVersion: '' }],
    },
    {
      ...detectionProvenance,
      sources: [{ ...detectionProvenance.sources[0], confidence: 1.1 }],
    },
    {
      ...detectionProvenance,
      sources: [{ ...detectionProvenance.sources[0], anchorTime: -1 }],
    },
  ])(
    'rejects malformed or unsupported review claims instead of silently stripping them (%j)',
    (provenance) => {
      expect(() =>
        parseTimelineDocument(
          JSON.stringify({
            version: 2,
            rows,
            instances: [{ ...instance, provenance }],
          }),
        ),
      ).toThrow('検出由来・確認状態');
    },
  );
});
