import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../types/timeline/core';
import { exportToCSV, exportToJSON } from './timelineExport';

describe('timeline CSV export', () => {
  it('protects all user text fields while preserving timecodes and stored values', () => {
    const timeline: TimelineData[] = [
      {
        id: 'synthetic-1',
        actionName: '=1+1',
        startTime: 12.345,
        endTime: 16.789,
        memo: '  @SUM(A1)',
        labels: [
          { group: 'Type', name: '+Type' },
          { group: 'Result', name: '-Result' },
        ],
      },
    ];
    const originalJson = exportToJSON(timeline);

    expect(exportToCSV(timeline)).toBe(
      '時刻,終了時刻,アクション名,タイプ,結果,備考\n' +
        '00:12,00:16,"\'=1+1","\'+Type","\'-Result","\'  @SUM(A1)"',
    );
    expect(exportToJSON(timeline)).toBe(originalJson);
    expect(JSON.parse(originalJson)).toEqual(timeline);
  });

  it('keeps ordinary quoting and multiline notes intact', () => {
    const timeline: TimelineData[] = [
      {
        id: 'synthetic-2',
        actionName: 'Team A, "Pass"',
        startTime: 3600,
        endTime: 3601,
        memo: 'first line\nsecond line',
      },
    ];
    expect(exportToCSV(timeline)).toContain(
      '01:00:00,01:00:01,"Team A, ""Pass""","","","first line\nsecond line"',
    );
  });
});
