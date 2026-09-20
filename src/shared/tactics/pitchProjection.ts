import type { PitchCalibration } from '../../types/playlist/core';
export interface Point2D {
  x: number;
  y: number;
}
const unit = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export const isValidPitchCalibration = (value: PitchCalibration): boolean => {
  const region = calibrationRegion(value);
  if (
    ![region.x, region.y, region.width, region.length].every(Number.isFinite) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.length <= 0 ||
    region.x + region.width > value.widthMeters ||
    region.y + region.length > value.lengthMeters ||
    (value.referenceTime !== undefined &&
      (!Number.isFinite(value.referenceTime) || value.referenceTime < 0))
  )
    return false;
  if (
    !Number.isFinite(value.widthMeters) ||
    !Number.isFinite(value.lengthMeters) ||
    value.widthMeters <= 0 ||
    value.lengthMeters <= 0 ||
    value.widthMeters > 200 ||
    value.lengthMeters > 200 ||
    value.corners.length !== 4
  )
    return false;
  if (
    value.corners.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1,
    )
  )
    return false;
  const signs = value.corners.map((a, i, points) => {
    const b = points[(i + 1) % 4];
    const c = points[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  return (
    signs.every((cross) => cross > 0.0001) ||
    signs.every((cross) => cross < -0.0001)
  );
};
export const calibrationRegion = (
  value: PitchCalibration,
): NonNullable<PitchCalibration['region']> =>
  value.region ?? {
    x: 0,
    y: 0,
    width: value.widthMeters,
    length: value.lengthMeters,
  };
const homography = (
  source: Point2D[],
  destination: Point2D[],
): number[] | null => {
  const matrix = source.flatMap(({ x, y }, index) => {
    const { x: u, y: v } = destination[index];
    return [
      [x, y, 1, 0, 0, 0, -u * x, -u * y, u],
      [0, 0, 0, x, y, 1, -v * x, -v * y, v],
    ];
  });
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++)
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column]))
        pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-10) return null;
    [matrix[pivot], matrix[column]] = [matrix[column], matrix[pivot]];
    const divisor = matrix[column][column];
    matrix[column] = matrix[column].map((value) => value / divisor);
    for (let row = 0; row < 8; row++)
      if (row !== column) {
        const multiplier = matrix[row][column];
        matrix[row] = matrix[row].map(
          (value, index) => value - multiplier * matrix[column][index],
        );
      }
  }
  return [...matrix.map((row) => row[8]), 1];
};
const transform = (matrix: number[] | null, point: Point2D): Point2D | null => {
  if (!matrix) return null;
  const denominator = matrix[6] * point.x + matrix[7] * point.y + 1;
  if (Math.abs(denominator) < 1e-10) return null;
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator,
  };
};
export const pitchToImage = (
  calibration: PitchCalibration,
  point: Point2D,
): Point2D | null =>
  isValidPitchCalibration(calibration)
    ? transform(homography(unit, calibration.corners), {
        x:
          (point.x - calibrationRegion(calibration).x) /
          calibrationRegion(calibration).width,
        y:
          (point.y - calibrationRegion(calibration).y) /
          calibrationRegion(calibration).length,
      })
    : null;
export const imageToPitch = (
  calibration: PitchCalibration,
  point: Point2D,
): Point2D | null => {
  if (!isValidPitchCalibration(calibration)) return null;
  const result = transform(homography(calibration.corners, unit), point);
  return result
    ? {
        x:
          calibrationRegion(calibration).x +
          result.x * calibrationRegion(calibration).width,
        y:
          calibrationRegion(calibration).y +
          result.y * calibrationRegion(calibration).length,
      }
    : null;
};
