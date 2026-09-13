import { describe, expect, it } from 'vitest';
import { resizeVideoBounds } from './videoWindowAspect';

describe('Windows video window resizing', () => {
  const previous = { x: 20, y: 40, width: 1000, height: 700 };
  const extra = { width: 200, height: 180 };
  it.each([16 / 9, 32 / 9])('excludes controls and window borders at ratio %s', (ratio) => {
    const result = resizeVideoBounds({ ...previous, width: 1200 }, previous, extra, ratio, [500, 400], 'right');
    expect((result.width - extra.width) / (result.height - extra.height)).toBeCloseTo(ratio, 2);
    expect(result.x).toBe(previous.x);
  });
  it('anchors the opposite edge and respects minimum content size', () => {
    const result = resizeVideoBounds({ ...previous, height: 300 }, previous, extra, 16 / 9, [500, 400], 'top');
    expect(result.y + result.height).toBe(previous.y + previous.height);
    expect(result.height).toBeGreaterThanOrEqual(400);
    expect(result.width).toBeGreaterThanOrEqual(500);
  });
});
