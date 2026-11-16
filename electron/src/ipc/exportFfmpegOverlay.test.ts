import { layoutClipExportText } from '../../../src/shared/clipExport/clipExportTextLayout';
import { describe, expect, it } from 'vitest';
import { escapeDrawtext } from './exportOptions';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import type { OverlayLine } from './exportFfmpegRunners';

const build = async (
  lines: OverlayLine[],
  variant: 'single' | 'dual' = 'single',
): Promise<string[]> =>
  buildOverlayFilters({
    layout: await layoutClipExportText(
      lines,
      { width: variant === 'single' ? 1920 : 3840, height: 1080 },
      async (text, _bold, size) => [...text].length * size,
    ),
    height: 1080,
    getJapaneseFontPath: () => '/font.ttf',
    escapeDrawtext: (text) => text,
  });

describe('buildOverlayFilters', () => {
  it('does not add hidden line breaks when escaping a wide English line', () => {
    expect(escapeDrawtext('support '.repeat(20))).not.toContain('\n');
  });
  it.each(['single', 'dual'] as const)(
    'lays out multiline notes without overlap for %s exports',
    async (variant) => {
      const filters = await build(
        [
          { text: '#1 Scrum', isBold: true },
          { text: '前へ\n外へ\n素早く', isBold: false },
        ],
        variant,
      );
      expect(filters).toHaveLength(5);
      expect(filters[0]).toContain('drawbox');
      const positions = filters
        .slice(1)
        .map((filter) => Number(filter.match(/:y=h\*([\d.]+)/)?.[1]));
      expect(
        positions.every(
          (position, index) =>
            position > (positions[index - 1] ?? 0) && position < 0.99,
        ),
      ).toBe(true);
      expect(filters[4]).toContain('text=素早く:expansion=none');
    },
  );
  it('wraps long Japanese text and preserves all characters', async () => {
    const text = '選手の位置を確認する。'.repeat(10);
    const filters = await build([{ text, isBold: false }]);
    expect(filters.length).toBeGreaterThan(2);
    expect(
      filters
        .slice(1)
        .map((filter) => filter.match(/:text=(.*):expansion=none/)?.[1])
        .join(''),
    ).toBe(text);
  });
  it('rejects overflowing notes instead of hiding content or shrinking below the minimum', async () => {
    await expect(
      build([{ text: 'note\n'.repeat(15), isBold: false }]),
    ).rejects.toThrow('20%');
  });
  it('does not render an empty black band when no text fields are selected', async () => {
    expect(await build([])).toEqual([]);
  });
});
