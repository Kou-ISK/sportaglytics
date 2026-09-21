import { expect, it } from 'vitest';
import {
  calculateAnchoredScrollLeft,
  clampZoomScale,
  visibleTimeMarkers,
  wheelZoomFactor,
} from './timelineZoom';

it('pinches beyond the old 10x cap and bounds extreme wheel deltas', () => {
  expect(clampZoomScale(10 * wheelZoomFactor(-30, 0))).toBeGreaterThan(13);
  expect(clampZoomScale(90 * wheelZoomFactor(-1000, 0))).toBe(100);
  expect(clampZoomScale(wheelZoomFactor(1000, 0))).toBe(1);
  expect(wheelZoomFactor(-1, 1)).toBe(wheelZoomFactor(-16, 0));
});
it('anchors the pointer including the sticky row header after zooming', () => {
  expect(
    calculateAnchoredScrollLeft({
      anchorTime: 30,
      viewportWidth: 1000,
      scrollWidth: 10000,
      anchorViewportX: 420,
      headerWidth: 120,
      timeToPosition: (time) => time * 20,
    }),
  ).toBe(300);
});
it('bounds tick count on long highly zoomed timelines and includes the visible position', () => {
  const markers = visibleTimeMarkers(86400, 1000, 100, 80000);
  expect(markers.length).toBeLessThan(20);
  expect(markers[0]).toBeLessThanOrEqual(69120);
  expect(markers.at(-1)).toBeGreaterThanOrEqual(69984);
});
