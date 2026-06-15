import { describe, expect, it } from 'vitest';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import type { OverlayLine } from './exportFfmpegRunners';

const overlayLines: OverlayLine[] = [
  { text: '#1 Team Scrum', isBold: true },
  { text: 'Result: Won', isBold: false },
];
const overlayLinesWithMemo: OverlayLine[] = [
  ...overlayLines,
  { text: 'memo text', isBold: false },
];

const buildFilters = (
  variant: 'single' | 'dual',
  lines = overlayLines,
): string[] =>
  buildOverlayFilters({
    overlayLines: lines,
    getJapaneseFontPath: () => '/font.ttf',
    escapeDrawtext: (text) => text,
    variant,
  });

describe('buildOverlayFilters', () => {
  it('uses a compact text box for single-angle exports', () => {
    const filters = buildFilters('single');

    expect(filters[0]).toContain('y=ih-(ih*0.14)');
    expect(filters[0]).toContain('h=(ih*0.14)');
    expect(filters.join(',')).toContain('fontsize=h*0.04');
    expect(filters.join(',')).toContain(
      'y=main_h-(main_h*0.14)+main_h*0.013',
    );
    expect(filters.join(',')).toContain('fontsize=h*0.033');
    expect(filters.join(',')).toContain('shadowx=1:shadowy=1');
  });

  it('keeps the single-angle text box height fixed when memo is present', () => {
    const filters = buildFilters('single');
    const filtersWithMemo = buildFilters('single', overlayLinesWithMemo);

    expect(filtersWithMemo[0]).toBe(filters[0]);
    expect(filtersWithMemo.join(',')).toContain('fontsize=h*0.029');
    expect(filtersWithMemo.join(',')).toContain(
      'y=main_h-(main_h*0.14)+main_h*0.104',
    );
  });

  it('keeps the taller text box for dual-angle exports', () => {
    const filters = buildFilters('dual');

    expect(filters[0]).toContain('h=95');
    expect(filters.join(',')).toContain('fontsize=34');
    expect(filters.join(',')).toContain('fontsize=28');
    expect(filters.join(',')).not.toContain('shadowx=');
  });
});
