import { describe, expect, it } from 'vitest';
import { escapeDrawtext } from './exportOptions';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import type { OverlayLine } from './exportFfmpegRunners';

const build = (
  lines: OverlayLine[],
  variant: 'single' | 'dual' = 'single',
): string[] =>
  buildOverlayFilters({
    overlayLines: lines,
    variant,
    getJapaneseFontPath: () => '/font.ttf',
    escapeDrawtext: (text) => text,
  });

describe('buildOverlayFilters', () => {
  it('does not add hidden line breaks when escaping a wide English line', () => {
    expect(escapeDrawtext('support '.repeat(20))).not.toContain('\n');
  });
  it.each(['single', 'dual'] as const)(
    'lays out multiline notes without overlap for %s exports',
    (variant) => {
      const filters = build(
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
      expect(filters[4]).toContain("text='素早く'");
    },
  );
  it('wraps long Japanese text and preserves all characters', () => {
    const text = '選手の位置を確認する。'.repeat(10);
    const filters = build([{ text, isBold: false }]);
    expect(filters.length).toBeGreaterThan(3);
    expect(
      filters
        .slice(1)
        .map((filter) => filter.match(/text='([^']*)'/)?.[1])
        .join(''),
    ).toBe(text);
  });
  it('rejects overflowing notes instead of hiding content or shrinking below the minimum', () => {
    expect(() => build([{ text: 'note\n'.repeat(15), isBold: false }])).toThrow(
      '20%',
    );
  });
  it('does not render an empty black band when no text fields are selected', () => {
    expect(build([])).toEqual([]);
  });
});
