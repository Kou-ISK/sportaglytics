import { expect, it } from 'vitest';
import {
  projectPitchDetections,
  suppressPitchDuplicates,
} from './pitchRecognition';
const person = {
  x: 0.4,
  y: 0.2,
  width: 0.1,
  height: 0.3,
  kind: 'neutral' as const,
  score: 0.9,
};
it('deduplicates overlapping crop detections and projects foot contact rather than body centre', () => {
  const detections = [
    person,
    { ...person, x: 0.402, score: 0.6 },
    { ...person, x: 0.7 },
  ];
  expect(suppressPitchDuplicates(detections)).toHaveLength(2);
  const markers = projectPitchDetections(detections, {
    corners: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    widthMeters: 70,
    lengthMeters: 100,
    region: { x: 0, y: 22, width: 70, length: 28 },
  });
  expect(markers[0].x).toBeCloseTo(31.5);
  expect(markers[0].y).toBeCloseTo(36);
});
it('discards spectators whose feet project outside the playing field', () => {
  expect(
    projectPitchDetections([{ ...person, y: 0.9 }], {
      corners: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      widthMeters: 70,
      lengthMeters: 100,
    }),
  ).toEqual([]);
});
