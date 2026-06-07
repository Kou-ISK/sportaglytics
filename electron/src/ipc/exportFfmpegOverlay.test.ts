import { describe, expect, it } from 'vitest';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import type { OverlayLine } from './exportFfmpegRunners';

const overlayLines: OverlayLine[] = [
  { text: '#1 Team Scrum', isBold: true },
  { text: 'Result: Won', isBold: false },
];

const buildFilters = (variant: 'single' | 'dual'): string[] =>
  buildOverlayFilters({
    overlayLines,
    getJapaneseFontPath: () => '/font.ttf',
    escapeDrawtext: (text) => text,
    variant,
  });

describe('buildOverlayFilters', () => {
  it('uses a compact text box for single-angle exports', () => {
    const filters = buildFilters('single');

    expect(filters[0]).toContain('h=74');
    expect(filters.join(',')).toContain('fontsize=30');
    expect(filters.join(',')).toContain('fontsize=24');
  });

  it('keeps the taller text box for dual-angle exports', () => {
    const filters = buildFilters('dual');

    expect(filters[0]).toContain('h=95');
    expect(filters.join(',')).toContain('fontsize=34');
    expect(filters.join(',')).toContain('fontsize=28');
  });
});
