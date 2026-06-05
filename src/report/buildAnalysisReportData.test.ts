import { describe, expect, it } from 'vitest';
import type { AnalysisDashboardConfig } from '../types/settings/coreTypes';
import type { TimelineData } from '../types/timeline/core';
import { buildAnalysisReportData } from './buildAnalysisReportData';

const timeline: TimelineData[] = [
  {
    id: '1',
    actionName: 'TeamA: Kick',
    startTime: 10,
    endTime: 15,
    memo: 'first',
    labels: [
      { group: 'Type', name: 'Kick' },
      { group: 'Result', name: 'Positive' },
    ],
  },
  {
    id: '2',
    actionName: 'TeamB: Carry',
    startTime: 20,
    endTime: 30,
    memo: 'second',
    labels: [
      { group: 'Type', name: 'Carry' },
      { group: 'Result', name: 'Negative' },
    ],
  },
];

const dashboard: AnalysisDashboardConfig = {
  activeDashboardId: 'd1',
  dashboards: [
    {
      id: 'd1',
      name: 'Main',
      widgets: [
        {
          id: 'w1',
          title: 'Result Breakdown',
          chartType: 'bar',
          metric: 'count',
          primaryAxis: { type: 'group', value: 'Result' },
          seriesEnabled: false,
          seriesAxis: { type: 'group', value: 'Result' },
          colSpan: 6,
          calc: 'raw',
        },
      ],
    },
  ],
};

describe('buildAnalysisReportData', () => {
  it('builds dashboard/momentum/matrix data with filter summaries', () => {
    const report = buildAnalysisReportData({
      timeline,
      resolvedTeamNames: ['TeamA', 'TeamB'],
      currentDashboardFilters: { action: 'Kick' },
      currentMatrixAxes: {
        row: { type: 'group', value: 'Type' },
        column: { type: 'group', value: 'Result' },
      },
      currentMatrixFilters: {
        team: 'all',
        action: 'all',
        labelGroup: 'all',
        labelValue: 'all',
      },
      analysisDashboard: dashboard,
    });

    expect(report.meta.filtersSummary).toContain('dashboard: action=Kick');
    expect(report.meta.timelineCount).toBe(2);
    expect(report.dashboard.filtersSummary).toBe('action=Kick');
    expect(report.dashboard.widgets.length).toBe(1);
    expect(report.dashboard.widgets[0]?.kind).toBe('chart');
    expect(report.dashboard.pages.length).toBeGreaterThan(0);
    expect(report.momentum.segments.length).toBeGreaterThanOrEqual(0);
    expect(report.matrix.sections.length).toBeGreaterThan(0);
    expect(report.matrix.sections[0]?.rowHeaders.length).toBeGreaterThan(0);
    expect(report.matrix.sections[0]?.columnHeaders.length).toBeGreaterThan(0);
    expect(report.matrix.sections[0]?.values.length).toBeGreaterThan(0);
    expect(report.matrix.visibleCount).toBeGreaterThan(0);
    expect(report.matrix.totalCount).toBe(2);
  });
});
