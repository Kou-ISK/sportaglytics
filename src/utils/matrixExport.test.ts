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
  it('protects text headers and labels but keeps numeric counts unchanged', () => {
    expect(
      buildMatrixCsv([
        ['=Column', '@Label', 'Count'],
        ['-Text', ' +Text', -2.5],
      ]),
    ).toBe('"\'=Column","\'@Label","Count"\n"\'-Text","\' +Text","-2.5"');
  });

  it('escapes CSV values safely', () => {
    const csv = buildMatrixCsv([
      ['Key', 'Value'],
      ['FilterAction', 'Kick, "Long"'],
    ]);

    expect(csv).toContain('"FilterAction","Kick, ""Long"""');
  });
});

describe('buildMatrixXlsxBase64', () => {
  it('keeps XLSX text as inline strings without CSV prefixes or formulas', () => {
    const decoded = atob(buildMatrixXlsxBase64([['=1+1', -2.5]]));
    expect(decoded).toContain(
      '<c r="A1" t="inlineStr"><is><t>=1+1</t></is></c>',
    );
    expect(decoded).toContain('<c r="B1"><v>-2.5</v></c>');
    expect(decoded).not.toContain('<f>');
  });

  it('returns non-empty base64 workbook', () => {
    const base64 = buildMatrixXlsxBase64([
      ['A&B', 'B'],
      [1, 'x < y'],
    ]);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(20);
    const decoded = atob(base64);
    expect(decoded.charCodeAt(0)).toBe(0x50);
    expect(decoded.charCodeAt(1)).toBe(0x4b);
    expect(decoded.charCodeAt(2)).toBe(0x03);
    expect(decoded.charCodeAt(3)).toBe(0x04);
    expect(decoded).toContain('[Content_Types].xml');
    expect(decoded).toContain('xl/worksheets/sheet1.xml');
    expect(decoded).toContain('A&amp;B');
    expect(decoded).toContain('<v>1</v>');
    expect(decoded).toContain('x &lt; y');
  });
});
