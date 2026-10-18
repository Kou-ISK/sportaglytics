import { describe, expect, it } from 'vitest';
import { toSpreadsheetCsvCell } from './csv';

describe('toSpreadsheetCsvCell', () => {
  it.each([
    '=1+1',
    '+1+1',
    '-1+1',
    '@SUM(A1)',
    '＝1+1',
    '＋1+1',
    '－1+1',
    '＠SUM(A1)',
    '  =1+1',
    '\uFEFF=1+1',
    '\u3000＝1+1',
    '\ttext',
    '\rtext',
    '\ntext',
    ' \t=1+1',
  ])('prefixes potentially interpreted text: %j', (text) => {
    expect(toSpreadsheetCsvCell(text)).toBe(`"'${text}"`);
  });

  it('contains delimiters, quotes and line breaks within one quoted cell', () => {
    expect(toSpreadsheetCsvCell('=1+1",;\n=2+2')).toBe('"\'=1+1"",;\n=2+2"');
    expect(toSpreadsheetCsvCell('note, "quoted"\nsecond line')).toBe(
      '"note, ""quoted""\nsecond line"',
    );
  });

  it('preserves plain text, empty text and an existing apostrophe', () => {
    for (const text of ['', ' ', 'Team A', '1+1', "'=1+1", '2026-10-18']) {
      expect(toSpreadsheetCsvCell(text)).toBe(`"${text}"`);
    }
  });

  it('distinguishes numeric values from text beginning with a minus sign', () => {
    expect(toSpreadsheetCsvCell(-2.5)).toBe('"-2.5"');
    expect(toSpreadsheetCsvCell(0)).toBe('"0"');
    expect(toSpreadsheetCsvCell(12.345)).toBe('"12.345"');
    expect(toSpreadsheetCsvCell('-2.5')).toBe('"\'-2.5"');
  });
});
