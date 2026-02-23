import { describe, expect, it } from 'vitest';
import type { MatrixAxisConfig } from '../types/MatrixConfig';
import {
  buildMatrixCsv,
  buildMatrixExportAoa,
  buildMatrixXlsxBase64,
} from './matrixExport';

const rowAxis: MatrixAxisConfig = { type: 'group', value: 'actionType' };
const columnAxis: MatrixAxisConfig = { type: 'group', value: 'actionResult' };

describe('buildMatrixExportAoa', () => {
  it('builds meta rows, data rows, and total rows correctly', () => {
    const aoa = buildMatrixExportAoa({
      meta: {
        exportedAtIso: '2026-02-23T12:00:00.000Z',
        rowAxis,
        columnAxis,
        filters: {
          team: 'TeamA',
          action: 'Kick',
          labelGroup: 'phase',
          labelValue: 'Set Piece',
        },
        visibleCount: 5,
        totalCount: 8,
      },
      table: {
        rowHeaders: [
          { parent: 'TeamA', child: 'Kick' },
          { parent: 'TeamB', child: 'Carry' },
        ],
        columnHeaders: [
          { parent: 'Result', child: 'Try' },
          { parent: 'Result', child: 'Turnover' },
        ],
        matrix: [
          [{ count: 2 }, { count: 1 }],
          [{ count: 1 }, { count: 3 }],
        ],
      },
    });

    expect(aoa[0]).toEqual(['ExportedAt', '2026-02-23T12:00:00.000Z']);
    expect(aoa[1]).toEqual(['RowAxis', 'group:actionType']);
    expect(aoa[2]).toEqual(['ColumnAxis', 'group:actionResult']);
    expect(aoa[10]).toEqual([
      'RowParent',
      'Row',
      'Result > Try',
      'Result > Turnover',
      'RowTotal',
    ]);

    expect(aoa[11]).toEqual(['TeamA', 'Kick', 2, 1, 3]);
    expect(aoa[12]).toEqual(['TeamB', 'Carry', 1, 3, 4]);
    expect(aoa[13]).toEqual(['ColumnTotal', '', 3, 4, 7]);
  });

  it('uses dash when filters are all', () => {
    const aoa = buildMatrixExportAoa({
      meta: {
        exportedAtIso: '2026-02-23T12:00:00.000Z',
        rowAxis: { type: 'team' },
        columnAxis: { type: 'action' },
        filters: {
          team: 'all',
          action: 'all',
          labelGroup: 'all',
          labelValue: 'all',
        },
        visibleCount: 0,
        totalCount: 0,
      },
      table: {
        rowHeaders: [],
        columnHeaders: [],
        matrix: [],
      },
    });

    expect(aoa[3]).toEqual(['FilterTeam', '-']);
    expect(aoa[4]).toEqual(['FilterAction', '-']);
    expect(aoa[5]).toEqual(['FilterLabelGroup', '-']);
    expect(aoa[6]).toEqual(['FilterLabelValue', '-']);
  });
});

describe('buildMatrixCsv', () => {
  it('escapes CSV values safely', () => {
    const csv = buildMatrixCsv([
      ['Key', 'Value'],
      ['FilterAction', 'Kick, "Long"'],
    ]);

    expect(csv).toContain('"FilterAction","Kick, ""Long"""');
  });
});

describe('buildMatrixXlsxBase64', () => {
  it('returns non-empty base64 workbook', () => {
    const base64 = buildMatrixXlsxBase64([
      ['A', 'B'],
      [1, 2],
    ]);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(20);
  });
});
