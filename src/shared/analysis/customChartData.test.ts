import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../types/timeline/core';
import { buildCustomChartData } from './customChartData';

describe('buildCustomChartData', () => {
  it('maps common Sportscode label group names to basic dashboard groups', () => {
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
          { group: '結果', name: 'Lost' },
          { group: '種別', name: 'Negative' },
        ],
      },
    ];

    const resultBreakdown = buildCustomChartData(
      timeline,
      ['actionResult', 'actionType'],
      {
        metric: 'count',
        primaryAxis: { type: 'group', value: 'actionResult' },
        seriesEnabled: false,
        seriesAxis: { type: 'group', value: 'actionResult' },
        calc: 'percentTotal',
        widgetFilters: { action: 'スクラム' },
      },
    );
    const typeBreakdown = buildCustomChartData(
      timeline,
      ['actionResult', 'actionType'],
      {
        metric: 'count',
        primaryAxis: { type: 'group', value: 'actionType' },
        seriesEnabled: false,
        seriesAxis: { type: 'group', value: 'actionType' },
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
