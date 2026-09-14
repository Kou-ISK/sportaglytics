import { describe, expect, it } from 'vitest';
import { findTrackingAnchors } from './trackingAnchor';
import { trackFeatures } from './featureTracker';
import { matchTemplate } from './templateTracker';
import type { GrayFrame, TrackPoint } from './templateTracker';
const frame = (dx: number, erased?: TrackPoint, noise = 0): GrayFrame => {
  const width = 140,
    height = 110;
  const pixels = new Uint8Array(width * height).fill(45);
  for (let y = 30; y < 78; y++)
    for (let x = 40; x < 80; x++) {
      const hidden = erased && Math.hypot(x - erased.x, y - erased.y) < 9;
      pixels[y * width + x + dx] = hidden
        ? 45
        : Math.max(
            0,
            Math.min(255, 65 + ((x * 79 + y * 113 + x * y * 17) % 140) + noise),
          );
    }
  return { width, height, pixels };
};
describe('multi-feature motion', () => {
  it('continues when the strongest feature is occluded and illumination changes', () => {
    const before = frame(0);
    const points = findTrackingAnchors(before, { x: 60, y: 55 }, 22, false);
    expect(points.length).toBeGreaterThan(4);
    const after = frame(5, points[0], 18);
    expect(matchTemplate(before, points[0], after).reliable).toBe(false);
    const motion = trackFeatures(before, after, points);
    expect(motion).toMatchObject({ reliable: true, dx: 5, dy: 0 });
    expect(motion.points.length).toBeGreaterThanOrEqual(2);
  });
  it('follows successive displacements without accumulating drift', () => {
    let points = findTrackingAnchors(frame(0), { x: 60, y: 55 }, 22, false);
    let dx = 0;
    for (let step = 1; step <= 10; step++) {
      const next = trackFeatures(
        frame((step - 1) * 3),
        frame(step * 3),
        points,
        { x: 3, y: 0 },
      );
      expect(next.reliable).toBe(true);
      points = next.points;
      dx += next.dx;
    }
    expect(dx).toBe(30);
  });
  it('rejects blank frames rather than inventing movement', () => {
    const before = frame(0);
    const points = findTrackingAnchors(before, { x: 60, y: 55 }, 22, false);
    expect(
      trackFeatures(
        before,
        { ...before, pixels: new Uint8Array(before.pixels.length).fill(45) },
        points,
      ).reliable,
    ).toBe(false);
  });
});

it('recovers a displacement outside the full-resolution search window', () => {
  const before = frame(0);
  const points = findTrackingAnchors(before, { x: 60, y: 55 }, 22, false);
  const motion = trackFeatures(before, frame(34), points);
  expect(motion).toMatchObject({ reliable: true, dx: 34, dy: 0 });
});

const smoothFrame = (dx: number): GrayFrame => {
  const width = 140,
    height = 110;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x - dx;
      pixels[y * width + x] = Math.round(
        125 +
          35 * Math.sin(u * 0.41 + y * 0.29) +
          30 * Math.sin(u * 0.19 - y * 0.43) +
          25 * Math.cos(u * 0.37 + y * 0.53),
      );
    }
  return { width, height, pixels };
};
it('preserves slow subpixel movement over successive frames', () => {
  let points = [
    { x: 50, y: 40 },
    { x: 62, y: 45 },
    { x: 56, y: 60 },
    { x: 72, y: 65 },
  ];
  let travel = 0;
  for (let step = 1; step <= 8; step++) {
    const motion = trackFeatures(
      smoothFrame((step - 1) * 0.5),
      smoothFrame(step * 0.5),
      points,
      { x: 0.5, y: 0 },
    );
    expect(motion.reliable).toBe(true);
    travel += motion.dx;
    points = motion.points;
  }
  expect(Math.abs(travel - 4)).toBeLessThan(0.6);
});

it('does not round repeated fractional motion to a quarter-pixel grid', () => {
  let points = [
    { x: 50, y: 40 },
    { x: 62, y: 45 },
    { x: 56, y: 60 },
    { x: 72, y: 65 },
  ];
  let travel = 0;
  for (let step = 1; step <= 20; step++) {
    const motion = trackFeatures(
      smoothFrame((step - 1) * 0.3),
      smoothFrame(step * 0.3),
      points,
      { x: 0.3, y: 0 },
    );
    expect(motion.reliable).toBe(true);
    travel += motion.dx;
    points = motion.points;
  }
  expect(Math.abs(travel - 6)).toBeLessThan(0.4);
});
