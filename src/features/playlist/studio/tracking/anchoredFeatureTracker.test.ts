import { describe, expect, it } from 'vitest';
import { createAnchoredFeatureTracker } from './anchoredFeatureTracker';
import { trackFeatures } from './featureTracker';
import { findTrackingAnchors } from './trackingAnchor';
import { displacementAt, fitFeatureMotion } from './featureMotionModel';
import type { GrayFrame, TrackPoint } from './templateTracker';

// Seeded, smoothly sampled texture gives subpixel ground truth without match footage.
const texture = new Uint8Array(180 * 150);
let seed = 17;
for (let index = 0; index < texture.length; index++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  texture[index] = 40 + (seed >>> 24) * 0.7;
}
const smooth = new Float64Array(texture.length);
for (let y = 2; y < 148; y++)
  for (let x = 2; x < 178; x++) {
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++)
        smooth[y * 180 + x] += texture[(y + j) * 180 + x + i] / 25;
  }
const makeFrame = (dx: number, dy: number, scale = 1): GrayFrame => {
  const width = 180,
    height = 150;
  const pixels = new Uint8Array(width * height).fill(45);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = (x - 70 - dx) / scale + 70,
        v = (y - 50 - dy) / scale + 50;
      const ix = Math.floor(u),
        iy = Math.floor(v),
        fx = u - ix,
        fy = v - iy;
      if (ix < 3 || ix >= 176 || iy < 3 || iy >= 146) continue;
      pixels[y * width + x] = Math.round(
        (smooth[iy * width + ix] * (1 - fx) +
          smooth[iy * width + ix + 1] * fx) *
          (1 - fy) +
          (smooth[(iy + 1) * width + ix] * (1 - fx) +
            smooth[(iy + 1) * width + ix + 1] * fx) *
            fy,
      );
    }
  return { width, height, pixels };
};
const initialPoints = (): TrackPoint[] => [
  { x: 50, y: 35 },
  { x: 72, y: 35 },
  { x: 90, y: 45 },
  { x: 50, y: 65 },
  { x: 72, y: 70 },
  { x: 90, y: 65 },
];

describe('attachment-aware tracking', () => {
  it('moves the footpoint with scale and rotation instead of the upper-body centroid', () => {
    const pairs = initialPoints().map((from) => ({
      from,
      to: {
        x: 1.02 * from.x - 0.01 * from.y + 2,
        y: 0.01 * from.x + 1.02 * from.y - 1,
      },
    }));
    const transform = fitFeatureMotion(pairs);
    expect(transform).toBeDefined();
    const offset = displacementAt(
      { dx: 2, dy: 0, transform },
      { x: 70, y: 105 },
    );
    expect(offset.x).toBeCloseTo(2.35, 8);
    expect(offset.y).toBeCloseTo(1.8, 8);
    expect(fitFeatureMotion(pairs.slice(0, 2))).toBeUndefined();
    expect(
      displacementAt({ dx: 2, dy: 0, transform }, { x: 1000, y: 1000 }),
    ).toEqual({ x: 2, y: 0 });
  });

  it('reduces cumulative footpoint error during slow translation and zoom', () => {
    let points = initialPoints(),
      baselinePoints = initialPoints();
    let frame = makeFrame(0, 0);
    const attachment = { x: 70, y: 105 };
    const tracker = createAnchoredFeatureTracker(frame, points, attachment);
    let baseline = { x: 0, y: 0 };
    let targetTravel = { x: 0, y: 0 };
    const errors: number[] = [],
      baselineErrors: number[] = [];
    for (let step = 1; step <= 45; step++) {
      const scale = 1 + step * 0.006;
      const next = makeFrame(step * 0.3, step * 0.1, scale);
      const prediction = { x: 0.3, y: 0.1 };
      const match = tracker.advance(frame, next, points, prediction);
      const old = trackFeatures(frame, next, baselinePoints, prediction);
      expect(match.reliable).toBe(true);
      expect(old.reliable).toBe(true);
      points = match.points;
      baselinePoints = old.points;
      baseline = { x: baseline.x + old.dx, y: baseline.y + old.dy };
      targetTravel = {
        x: targetTravel.x + match.dx,
        y: targetTravel.y + match.dy,
      };
      if (points.length < 4)
        points = findTrackingAnchors(
          next,
          { x: 70 + targetTravel.x, y: 50 + targetTravel.y },
          25,
          false,
        );
      if (baselinePoints.length < 4)
        baselinePoints = findTrackingAnchors(
          next,
          { x: 70 + baseline.x, y: 50 + baseline.y },
          25,
          false,
        );
      const truth = { x: step * 0.3, y: step * 0.1 + 55 * (scale - 1) };
      errors.push(
        Math.hypot(
          tracker.position().x - truth.x,
          tracker.position().y - truth.y,
        ),
      );
      baselineErrors.push(
        Math.hypot(baseline.x - truth.x, baseline.y - truth.y),
      );
      frame = next;
    }
    const average = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    console.info('Synthetic footpoint pixels', {
      baselineMean: average(baselineErrors),
      mean: average(errors),
      max: Math.max(...errors),
    });
    expect(average(errors)).toBeLessThan(average(baselineErrors) * 0.5);
    expect(Math.max(...errors)).toBeLessThan(2);
    const position = tracker.position();
    expect(
      tracker.advance(
        frame,
        { ...frame, pixels: new Uint8Array(frame.pixels.length).fill(45) },
        points,
        { x: 0, y: 0 },
      ).reliable,
    ).toBe(false);
    expect(tracker.position()).toEqual(position);
  }, 15000);
});
