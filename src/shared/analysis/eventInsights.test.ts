import { describe, expect, it } from 'vitest';
import {
  buildEventInsights,
  filterTimelineByEvidenceFilters,
} from './eventInsights';

describe('eventInsights', () => {
  it('builds summary, transitions, and sequence insights from ordered timeline data', () => {
    const timeline = [
      {
        id: '1',
        actionName: 'TeamA Pass',
        startTime: 0,
        endTime: 2,
        memo: '',
        labels: [{ group: 'phase', name: 'build' }],
      },
      {
        id: '2',
        actionName: 'TeamA Carry',
        startTime: 3,
        endTime: 5,
        memo: '',
        labels: [{ group: 'phase', name: 'attack' }],
      },
      {
        id: '3',
        actionName: 'TeamA Pass',
        startTime: 6,
        endTime: 8,
        memo: '',
        labels: [{ group: 'phase', name: 'attack' }],
      },
    ];

    const insights = buildEventInsights(timeline, {
      dimension: { type: 'action' },
      topN: 3,
      sequenceLength: 2,
    });

    expect(insights.summary.totalEvents).toBe(3);
    expect(insights.topStates[0]).toMatchObject({
      state: 'TeamA Pass',
      count: 2,
    });
    expect(insights.topTransitions[0]).toMatchObject({
      from: 'TeamA Pass',
      to: 'TeamA Carry',
      count: 1,
    });
    expect(insights.topSequences[0]).toMatchObject({
      sequence: ['TeamA Pass', 'TeamA Carry'],
      count: 1,
    });
    expect(insights.phaseDistribution).toHaveLength(3);
  });

  it('filters timeline items by time range and labels before insight generation', () => {
    const timeline = [
      {
        id: '1',
        actionName: 'Pass',
        startTime: 0,
        endTime: 2,
        memo: '',
        labels: [{ group: 'phase', name: 'build' }],
      },
      {
        id: '2',
        actionName: 'Shot',
        startTime: 8,
        endTime: 10,
        memo: '',
        labels: [{ group: 'phase', name: 'attack' }],
      },
    ];

    const filtered = filterTimelineByEvidenceFilters(timeline, {
      timeRange: { start: 5, end: 12 },
      labelFilters: [{ group: 'phase', name: 'attack' }],
    });

    expect(filtered).toEqual([timeline[1]]);
  });
});
