import { describe, expect, it } from 'vitest';
import {
  buildMatrixCsv,
  buildMatrixExportAoa,
  buildMatrixXlsxBase64,
} from './matrixExport';

describe('buildMatrixExportAoa', () => {
  it('builds a single matrix table with total rows', () => {
    const aoa = buildMatrixExportAoa({
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

    expect(aoa[0]).toEqual([
      'RowParent',
      'Row',
      'Result > Try',
      'Result > Turnover',
      'RowTotal',
    ]);

    expect(aoa[1]).toEqual(['TeamA', 'Kick', 2, 1, 3]);
    expect(aoa[2]).toEqual(['TeamB', 'Carry', 1, 3, 4]);
    expect(aoa[3]).toEqual(['ColumnTotal', '', 3, 4, 7]);
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
