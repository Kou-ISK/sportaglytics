import { describe, expect, it, vi } from 'vitest';
import {
  layoutClipExportText,
  type MeasureClipText,
} from './clipExportTextLayout';
// Deterministic font port. Real font/FFmpeg parity is checked by the export regression.
const measure: MeasureClipText = async (text, _bold, size) =>
  Array.from(
    new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text),
  ).reduce(
    (width, { segment }) => width + (/^[ -~]$/.test(segment) ? 0.5 : 1) * size,
    0,
  );
const size = { width: 1920, height: 1080 };
const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    text: `位置 ${index + 1}`,
    isBold: false,
  }));
describe('export text layout', () => {
  it('uses only the background needed for short notes', async () => {
    const result = await layoutClipExportText(lines(1), size, measure);
    expect(result.boxRatio).toBeLessThan(0.06);
    expect(result.fontRatio * 1080).toBe(30);
  });
  it.each([9 / 16, 4 / 3, 16 / 9, 32 / 9])(
    'bounds all rows at aspect %s',
    async (aspect) => {
      for (let count = 1; count <= 100; count++) {
        const result = await layoutClipExportText(
          lines(count),
          { width: 1080 * aspect, height: 1080 },
          measure,
        );
        expect(result.boxRatio).toBeLessThanOrEqual(0.2);
        expect(result.fontRatio * 1080).toBeGreaterThanOrEqual(24);
        expect(result.overflow).toBe(count > 6);
      }
    },
  );
  it('uses the available width instead of premature 1.2em Japanese estimates', async () => {
    const text = '前'.repeat(60);
    const result = await layoutClipExportText(
      [{ text, isBold: false }],
      size,
      measure,
    );
    expect(result.lines.map((line) => line.text)).toEqual([text]);
    const wrapped = await layoutClipExportText(
      [{ text: '前'.repeat(70), isBold: false }],
      size,
      measure,
    );
    expect(wrapped.lines.map((line) => line.text.length)).toEqual([62, 8]);
  });
  it.each([720, 1080, 2160])(
    'fits each measured row at height %s',
    async (height) => {
      const geometry = { width: (height * 16) / 9, height };
      const text = 'Position and 支援の位置を確認 '.repeat(12);
      const result = await layoutClipExportText(
        [{ text, isBold: true }],
        geometry,
        measure,
      );
      expect(result.lines.map((line) => line.text).join('')).toBe(text);
      for (const line of result.lines)
        expect(
          await measure(line.text, line.isBold, height * result.fontRatio),
        ).toBeLessThanOrEqual(geometry.width * 0.97 - 2);
    },
  );
  it('preserves explicit blank lines, Unicode and all long note text', async () => {
    const text = '前へ\r\n\r外へ\n' + '選手👨‍👩‍👧‍👦か\u3099'.repeat(120);
    const result = await layoutClipExportText(
      [{ text, isBold: false }],
      { width: 1080, height: 1920 },
      measure,
    );
    expect(result.overflow).toBe(true);
    expect(result.lines.map((line) => line.text).join('')).toBe(
      text.replace(/[\r\n]/g, ''),
    );
    expect(result.lines[1].text).toBe('');
    expect(result.lines.some((line) => line.text.includes('👨‍👩‍👧‍👦'))).toBe(true);
  });
  it('wraps English at spaces while splitting long tokens only between graphemes', async () => {
    const text = 'support position '.repeat(12);
    const result = await layoutClipExportText(
      [{ text, isBold: false }],
      size,
      measure,
    );
    expect(result.lines[0].text.endsWith(' ')).toBe(true);
    expect(result.lines.map((line) => line.text).join('')).toBe(text);
  });
  it('measures full candidates with their actual weight and pixel size', async () => {
    const port = vi.fn(measure);
    await layoutClipExportText(
      [{ text: 'AV', isBold: true }],
      { width: 1280, height: 720 },
      port,
    );
    expect(port).toHaveBeenCalledWith('AV', true, 20);
  });
  it('blocks a grapheme wider than the available area', async () => {
    const result = await layoutClipExportText(
      [{ text: '👨‍👩‍👧‍👦', isBold: false }],
      { width: 10, height: 1080 },
      measure,
    );
    expect(result.overflow).toBe(true);
    expect(result.lines[0].text).toBe('👨‍👩‍👧‍👦');
  });
  it('does not measure or draw an empty overlay', async () => {
    const port = vi.fn(measure);
    expect((await layoutClipExportText([], size, port)).boxRatio).toBe(0);
    expect(port).not.toHaveBeenCalled();
  });
  it('propagates unavailable metrics instead of guessing', async () => {
    await expect(
      layoutClipExportText(lines(1), size, async () => {
        throw Error('metrics unavailable');
      }),
    ).rejects.toThrow('metrics unavailable');
  });
});

it('stops measuring once an overlong note cannot fit, preserving its remainder', async () => {
  const text = '前'.repeat(100000);
  const port = vi.fn(measure);
  const result = await layoutClipExportText(
    [{ text, isBold: false }],
    size,
    port,
  );
  expect(result.overflow).toBe(true);
  expect(result.lines.map((line) => line.text).join('')).toBe(text);
  expect(port.mock.calls.length).toBeLessThan(250);
});
