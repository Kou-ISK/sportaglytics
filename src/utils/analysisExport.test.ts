import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../types/timeline/core';
import {
  buildAnalysisSummaryText,
  exportRawAnalysisCsv,
} from './analysisExport';

const parseCsvLine = (line: string): string[] =>
  line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));

describe('exportRawAnalysisCsv', () => {
  it('expands label groups with fixed header order and escapes values', () => {
    const timeline: TimelineData[] = [
      {
        id: 'evt-1',
        actionName: 'TeamA Kick, Long',
        startTime: 12.345,
        endTime: 16.789,
        memo: 'plain memo',
        color: '#112233',
        labels: [
          { group: 'actionType', name: 'Kick' },
          { group: 'actionResult', name: 'Try' },
          { group: 'zone', name: '22m' },
          { group: 'phase', name: 'Set Piece' },
        ],
      },
      {
        id: 'evt-2',
        actionName: 'TeamB Carry',
        startTime: 20,
        endTime: 22,
        memo: 'line1\nline2, "quote"',
        labels: [{ group: 'actionType', name: 'Carry' }],
      },
    ];

    const csv = exportRawAnalysisCsv(timeline);
    const [headerLine, row1Line] = csv.split('\n');
    const header = parseCsvLine(headerLine ?? '');
    const row1 = parseCsvLine(row1Line ?? '');

    expect(header).toEqual([
      'index',
      'id',
      'startSec',
      'endSec',
      'durationSec',
      'startTimecode',
      'endTimecode',
      'team',
      'action',
      'actionName',
      'memo',
      'color',
      'labelCount',
      'labels',
      'label:actionType',
      'label:actionResult',
      'label:phase',
      'label:zone',
    ]);

    const columnIndex = Object.fromEntries(
      header.map((name, index) => [name, index]),
    ) as Record<string, number>;

    expect(row1[columnIndex.index]).toBe('1');
    expect(row1[columnIndex.id]).toBe('evt-1');
    expect(row1[columnIndex.team]).toBe('TeamA');
    expect(row1[columnIndex.action]).toBe('Kick, Long');
    expect(row1[columnIndex['label:actionType']]).toBe('Kick');
    expect(row1[columnIndex['label:actionResult']]).toBe('Try');
    expect(row1[columnIndex['label:phase']]).toBe('Set Piece');
    expect(row1[columnIndex['label:zone']]).toBe('22m');

    expect(csv).toContain('"line1\nline2, ""quote"""');
    expect(csv).toContain('"TeamA Kick, Long"');
  });

  it('falls back to legacy actionType/actionResult when labels are missing', () => {
    const timeline = [
      {
        id: 'legacy-1',
        actionName: 'TeamA Counter',
        startTime: 0,
        endTime: 5,
        memo: '',
        actionType: 'Counter',
        actionResult: 'Turnover',
      },
    ] as unknown as TimelineData[];

    const csv = exportRawAnalysisCsv(timeline);
    const [headerLine, rowLine] = csv.split('\n');
    const header = parseCsvLine(headerLine ?? '');
    const row = parseCsvLine(rowLine ?? '');
    const columnIndex = Object.fromEntries(
      header.map((name, index) => [name, index]),
    ) as Record<string, number>;

    expect(row[columnIndex['label:actionType']]).toBe('Counter');
    expect(row[columnIndex['label:actionResult']]).toBe('Turnover');
  });
});

describe('buildAnalysisSummaryText', () => {
  it('contains structured sections and meaningful metrics', () => {
    const timeline: TimelineData[] = [
      {
        id: 'm1',
        actionName: 'TeamA ポゼッション',
        startTime: 10,
        endTime: 18,
        memo: '',
        labels: [
          { group: 'actionType', name: 'Kick' },
          { group: 'actionResult', name: 'Try' },
        ],
      },
      {
        id: 'm2',
        actionName: 'TeamB ポゼッション',
        startTime: 20,
        endTime: 27,
        memo: '',
        labels: [
          { group: 'actionType', name: 'Carry' },
          { group: 'actionResult', name: 'Turnover' },
        ],
      },
      {
        id: 'm3',
        actionName: 'TeamA Attack',
        startTime: 30,
        endTime: 35,
        memo: '',
        labels: [{ group: 'actionResult', name: 'Try' }],
      },
    ];

    const summary = buildAnalysisSummaryText({
      view: 'dashboard',
      timeline,
      teamNames: ['TeamA', 'TeamB'],
    });

    expect(summary).toContain('[概要]');
    expect(summary).toContain('[チーム比較]');
    expect(summary).toContain('[主要アクション]');
    expect(summary).toContain('[主要結果]');
    expect(summary).toContain('[フロー傾向]');
    expect(summary).toContain('[モメンタム要約]');
    expect(summary).toContain('TeamA');
    expect(summary).toContain('Try');
    expect(summary).toContain('Outcome: Try');
  });

  it('keeps all sections and shows N/A for empty timeline', () => {
    const summary = buildAnalysisSummaryText({
      view: 'matrix',
      timeline: [],
      teamNames: [],
    });

    expect(summary).toContain('[概要]');
    expect(summary).toContain('[チーム比較]');
    expect(summary).toContain('[主要アクション]');
    expect(summary).toContain('[主要結果]');
    expect(summary).toContain('[フロー傾向]');
    expect(summary).toContain('[モメンタム要約]');

    const naCount = (summary.match(/N\/A/g) ?? []).length;
    expect(naCount).toBeGreaterThanOrEqual(4);
  });
});
