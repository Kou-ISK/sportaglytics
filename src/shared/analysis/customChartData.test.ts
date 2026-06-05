import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../types/timeline/core';
import { buildCustomChartData } from './customChartData';

describe('buildCustomChartData', () => {
  it('keeps label groups independent when building dashboard data', () => {
    const timeline: TimelineData[] = [
      {
        id: 'entry-1',
        actionName: 'TeamA スクラム',
        startTime: 0,
        endTime: 5,
        memo: '',
        labels: [
          { group: 'Result', name: 'Won' },
          { group: 'Type', name: 'Positive' },
        ],
      },
      {
        id: 'entry-2',
        actionName: 'TeamA スクラム',
        startTime: 6,
        endTime: 9,
        memo: '',
        labels: [
          { group: 'Result', name: 'Lost' },
          { group: 'Type', name: 'Negative' },
        ],
      },
    ];

    const resultBreakdown = buildCustomChartData(
      timeline,
      ['Result', 'Type'],
      {
        metric: 'count',
        primaryAxis: { type: 'group', value: 'Result' },
        seriesEnabled: false,
        seriesAxis: { type: 'group', value: 'Result' },
        calc: 'percentTotal',
        widgetFilters: { action: 'スクラム' },
      },
    );
    const typeBreakdown = buildCustomChartData(
      timeline,
      ['Result', 'Type'],
      {
        metric: 'count',
        primaryAxis: { type: 'group', value: 'Type' },
        seriesEnabled: false,
        seriesAxis: { type: 'group', value: 'Type' },
        calc: 'percentTotal',
        widgetFilters: { action: 'スクラム', labelGroup: 'Result' },
      },
    );

    expect(resultBreakdown.data.map((row) => row.name)).toEqual([
      'Won',
      'Lost',
    ]);
    expect(typeBreakdown.data.map((row) => row.name)).toEqual([
      'Positive',
      'Negative',
    ]);
  });
});
