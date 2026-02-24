import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../types/TimelineData';
import type { DashboardWidgetReportData } from './types';
import {
  buildMatrixSectionsByTeamAction,
  compactMatrixWithOthers,
  paginateDashboardWidgets,
} from './printLayoutUtils';

const buildWidget = (
  id: string,
  colSpan: 4 | 6 | 12,
): DashboardWidgetReportData => ({
  kind: 'chart',
  id,
  title: id,
  colSpan,
  chartType: 'bar',
  metric: 'count',
  calcMode: 'raw',
  unitLabel: '件',
  seriesKeys: ['value'],
  data: [{ name: id, value: 1 }],
  hasData: true,
  showLegend: false,
});

const sumMatrix = (values: number[][]) =>
  values.reduce(
    (rowSum, row) => rowSum + row.reduce((s, value) => s + value, 0),
    0,
  );

const buildTimelineEntry = (
  id: string,
  team: string,
  action: string,
  result: string,
): TimelineData => ({
  id,
  actionName: `${team} ${action}`,
  startTime: Number(id),
  endTime: Number(id) + 2,
  memo: '',
  labels: [
    { group: 'actionType', name: action },
    { group: 'actionResult', name: result },
  ],
});

describe('paginateDashboardWidgets', () => {
  it('splits widgets by row units and page row limits', () => {
    const widgets = [
      buildWidget('w1', 6),
      buildWidget('w2', 6),
      buildWidget('w3', 12),
      buildWidget('w4', 4),
      buildWidget('w5', 4),
      buildWidget('w6', 4),
      buildWidget('w7', 12),
    ];

    const pages = paginateDashboardWidgets(widgets, {
      firstPageMaxRows: 2,
      nextPageMaxRows: 3,
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]?.rowCount).toBe(2);
    expect(pages[0]?.widgets.map((widget) => widget.id)).toEqual([
      'w1',
      'w2',
      'w3',
    ]);
    expect(pages[1]?.rowCount).toBe(2);
    expect(pages[1]?.widgets.map((widget) => widget.id)).toEqual([
      'w4',
      'w5',
      'w6',
      'w7',
    ]);
  });
});

describe('compactMatrixWithOthers', () => {
  it('enforces max 12x12 and preserves total count via others buckets', () => {
    const rowHeaders = Array.from({ length: 14 }, (_, index) => ({
      parent: index < 7 ? 'A' : 'B',
      child: `R${index + 1}`,
    }));
    const columnHeaders = Array.from({ length: 14 }, (_, index) => ({
      parent: index < 7 ? 'X' : 'Y',
      child: `C${index + 1}`,
    }));
    const values = rowHeaders.map((_, rowIndex) =>
      columnHeaders.map((_, colIndex) => (rowIndex === colIndex ? 20 : 1)),
    );

    const compacted = compactMatrixWithOthers({
      rowHeaders,
      columnHeaders,
      values,
      maxRows: 12,
      maxColumns: 12,
    });

    expect(compacted.rowHeaders).toHaveLength(12);
    expect(compacted.columnHeaders).toHaveLength(12);
    expect(compacted.rowHeaders[11]?.child).toBe('その他');
    expect(compacted.columnHeaders[11]?.child).toBe('その他');
    expect(sumMatrix(compacted.values)).toBe(sumMatrix(values));
  });
});

describe('buildMatrixSectionsByTeamAction', () => {
  it('builds team/action sections, applies max table cap, and merges overflow into others', () => {
    const timeline: TimelineData[] = [];
    let id = 1;
    const pushMany = (
      team: string,
      action: string,
      result: string,
      count: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        timeline.push(buildTimelineEntry(String(id), team, action, result));
        id += 1;
      }
    };

    pushMany('TeamA', 'Kick', 'Positive', 5);
    pushMany('TeamB', 'Kick', 'Negative', 4);
    pushMany('TeamA', 'Carry', 'Positive', 3);
    pushMany('TeamC', 'Pass', 'Neutral', 2);
    pushMany('TeamD', 'Pass', 'Neutral', 1);

    const sections = buildMatrixSectionsByTeamAction({
      timeline,
      rowAxis: { type: 'group', value: 'actionType' },
      columnAxis: { type: 'group', value: 'actionResult' },
      filters: {
        team: 'all',
        action: 'all',
        labelGroup: 'all',
        labelValue: 'all',
      },
      maxTables: 3,
      maxRows: 12,
      maxColumns: 12,
    });

    expect(sections).toHaveLength(3);
    expect(sections[0]?.title).toBe('TeamA / Kick');
    expect(sections[1]?.title).toBe('TeamB / Kick');
    expect(sections[2]?.isOthersBucket).toBe(true);
    expect(sections[2]?.title).toContain('その他');
    sections.forEach((section) => {
      expect(section.rowHeaders.length).toBeLessThanOrEqual(12);
      expect(section.columnHeaders.length).toBeLessThanOrEqual(12);
      expect(section.totalCount).toBe(timeline.length);
    });
  });
});
