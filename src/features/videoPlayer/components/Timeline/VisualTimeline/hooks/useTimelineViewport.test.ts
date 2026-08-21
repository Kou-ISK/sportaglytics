import { describe, expect, it } from 'vitest';
import { calculateAnchoredScrollLeft } from './useTimelineViewport';

describe('calculateAnchoredScrollLeft', () => {
  it('keeps the anchored time at the viewport center after zooming', () => {
    const nextScrollLeft = calculateAnchoredScrollLeft({
      anchorTime: 30,
      viewportWidth: 400,
      scrollWidth: 2_400,
      timeToPosition: (time) => time * 20,
    });

    expect(nextScrollLeft).toBe(400);
  });

  it('does not scroll beyond the timeline bounds', () => {
    const nextScrollLeft = calculateAnchoredScrollLeft({
      anchorTime: 2,
      viewportWidth: 400,
      scrollWidth: 1_000,
      timeToPosition: (time) => time * 10,
    });

    expect(nextScrollLeft).toBe(0);
  });
});
