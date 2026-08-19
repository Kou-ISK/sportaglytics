import { describe, expect, it } from 'vitest';
import { createTimelineCoordinateMapper } from './timelineCoordinateMapper';

describe('timeline coordinate mapper', () => {
  it('keeps pixel width proportional to duration', () => {
    const mapper = createTimelineCoordinateMapper({
      maxSec: 100,
      baseContentWidth: 1000,
      zoomScale: 1,
    });

    const fiveSeconds = mapper.timeToContentX(15) - mapper.timeToContentX(10);
    const tenSeconds = mapper.timeToContentX(20) - mapper.timeToContentX(10);

    expect(tenSeconds).toBeCloseTo(fiveSeconds * 2);
  });

  it('scales all timeline distances equally with zoom', () => {
    const normal = createTimelineCoordinateMapper({
      maxSec: 100,
      baseContentWidth: 1000,
      zoomScale: 1,
    });
    const zoomed = createTimelineCoordinateMapper({
      maxSec: 100,
      baseContentWidth: 1000,
      zoomScale: 2,
    });

    expect(zoomed.timeToContentX(40)).toBeCloseTo(
      normal.timeToContentX(40) * 2,
    );
  });

  it('round-trips time and content coordinates', () => {
    const mapper = createTimelineCoordinateMapper({
      maxSec: 612,
      baseContentWidth: 840,
      zoomScale: 3.25,
    });

    expect(mapper.contentXToTime(mapper.timeToContentX(237.4))).toBeCloseTo(
      237.4,
    );
  });

  it('converts client x through the shared row-header offset', () => {
    const mapper = createTimelineCoordinateMapper({
      maxSec: 100,
      baseContentWidth: 1000,
      zoomScale: 1,
      rowHeaderWidth: 120,
    });

    expect(mapper.clientXToContentX(470, 100)).toBe(250);
    expect(mapper.contentXToViewportX(250, 100, 50)).toBe(420);
  });

  it('clamps content coordinates to the package timeline range', () => {
    const mapper = createTimelineCoordinateMapper({
      maxSec: 100,
      baseContentWidth: 1000,
      zoomScale: 1,
    });

    expect(mapper.contentXToTime(-50)).toBe(0);
    expect(mapper.contentXToTime(1200)).toBe(100);
    expect(mapper.timeToContentX(-5)).toBe(0);
    expect(mapper.timeToContentX(120)).toBe(1000);
  });
});
