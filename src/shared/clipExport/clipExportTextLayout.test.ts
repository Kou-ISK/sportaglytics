import { describe, expect, it } from 'vitest';
import { layoutClipExportText } from './clipExportTextLayout';
const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    text: `位置 ${index + 1}`,
    isBold: false,
  }));
describe('export text layout', () => {
  it('uses only the background needed for short notes', () => {
    const result = layoutClipExportText(lines(1), 16 / 9);
    expect(result.boxRatio).toBeLessThan(0.06);
    expect(result.fontRatio * 1080).toBe(30);
  });
  it.each([9 / 16, 4 / 3, 16 / 9, 32 / 9])(
    'bounds all rows at aspect %s',
    (aspect) => {
      for (let count = 1; count <= 100; count++) {
        const result = layoutClipExportText(lines(count), aspect);
        expect(result.boxRatio).toBeLessThanOrEqual(0.2);
        expect(result.fontRatio * 1080).toBeGreaterThanOrEqual(24);
        expect(result.overflow).toBe(count > 6);
      }
    },
  );
  it('preserves explicit blank lines, Unicode and all long note text', () => {
    const text = '前へ\n\n外へ\n' + '選手👨‍👩‍👧‍👦か\u3099'.repeat(120);
    const result = layoutClipExportText([{ text, isBold: false }], 9 / 16);
    expect(result.overflow).toBe(true);
    expect(result.lines.map((line) => line.text).join('')).toBe(
      text.replaceAll('\n', ''),
    );
    expect(result.lines[1].text).toBe('');
    expect(result.lines.some((line) => line.text.includes('👨‍👩‍👧‍👦'))).toBe(true);
  });
  it('does not draw a band when no fields have text', () => {
    expect(layoutClipExportText([], 16 / 9).boxRatio).toBe(0);
  });
});
