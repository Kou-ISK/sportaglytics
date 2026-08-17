import { describe, expect, it } from 'vitest';
import type { EventTimelineMapping } from '../../../../types/eventDetection/core';
import type { TimelineData } from '../../../../types/timeline/core';
import { convertCandidatesToTimeline } from './candidatesToTimeline';

const mappings: EventTimelineMapping[] = [
  {
    eventType: 'scrum',
    actionName: 'Scrum',
    enabled: true,
    minConfidence: 0.95,
    leadTimeSeconds: 5,
    lagTimeSeconds: 10,
  },
  {
    eventType: 'lineout',
    actionName: 'Lineout',
    enabled: true,
    minConfidence: 0.95,
    leadTimeSeconds: 4,
    lagTimeSeconds: 8,
  },
];

const existing = (
  actionName: string,
  startTime: number,
  endTime: number,
): TimelineData => ({
  id: `${actionName}-${startTime}`,
  actionName,
  startTime,
  endTime,
  memo: '',
});

describe('convertCandidatesToTimeline', () => {
  it('creates ordinary timeline items using configured lead and lag', () => {
    const result = convertCandidatesToTimeline({
      candidates: [
        {
          id: 'scrum-1',
          eventType: 'scrum',
          confidence: 0.99,
          anchorTime: 100,
        },
      ],
      mappings,
      existingTimeline: [],
      maxTime: 200,
    });

    expect(result.items).toEqual([
      {
        actionName: 'Scrum',
        startTime: 95,
        endTime: 110,
        memo: '',
      },
    ]);
  });

  it('drops candidates below the configured confidence threshold', () => {
    const result = convertCandidatesToTimeline({
      candidates: [
        {
          id: 'scrum-low',
          eventType: 'scrum',
          confidence: 0.94,
          anchorTime: 100,
        },
      ],
      mappings,
      existingTimeline: [],
    });

    expect(result.items).toHaveLength(0);
    expect(result.skippedLowConfidence).toBe(1);
  });

  it('does not add the same detected event again on a rerun', () => {
    const result = convertCandidatesToTimeline({
      candidates: [
        {
          id: 'scrum-repeat',
          eventType: 'scrum',
          confidence: 0.99,
          anchorTime: 100.5,
        },
      ],
      mappings,
      existingTimeline: [existing('Scrum', 95, 110)],
    });

    expect(result.items).toHaveLength(0);
    expect(result.skippedDuplicate).toBe(1);
  });

  it('deduplicates candidates within one automatic detection result', () => {
    const result = convertCandidatesToTimeline({
      candidates: [
        {
          id: 'lineout-1',
          eventType: 'lineout',
          confidence: 0.99,
          anchorTime: 50,
        },
        {
          id: 'lineout-2',
          eventType: 'lineout',
          confidence: 0.98,
          anchorTime: 50.8,
        },
      ],
      mappings,
      existingTimeline: [],
    });

    expect(result.items).toHaveLength(1);
    expect(result.skippedDuplicate).toBe(1);
  });

  it('keeps different event types even when their time ranges overlap', () => {
    const result = convertCandidatesToTimeline({
      candidates: [
        {
          id: 'scrum-1',
          eventType: 'scrum',
          confidence: 0.99,
          anchorTime: 100,
        },
        {
          id: 'lineout-1',
          eventType: 'lineout',
          confidence: 0.99,
          anchorTime: 100,
        },
      ],
      mappings,
      existingTimeline: [],
    });

    expect(result.items.map((item) => item.actionName)).toEqual([
      'Scrum',
      'Lineout',
    ]);
  });
});
