import type { TrackPoint } from './templateTracker';

export interface FeatureCorrespondence {
  from: TrackPoint;
  to: TrackPoint;
}
export interface SimilarityMotion {
  a: number;
  b: number;
  tx: number;
  ty: number;
  center: TrackPoint;
  radius: number;
}

/** Small, well-supported camera scale/rotation, never an unconstrained affine warp. */
export const fitFeatureMotion = (
  pairs: readonly FeatureCorrespondence[],
): SimilarityMotion | undefined => {
  if (pairs.length < 4) return undefined;
  const mean = (side: 'from' | 'to'): TrackPoint => ({
    x: pairs.reduce((sum, pair) => sum + pair[side].x, 0) / pairs.length,
    y: pairs.reduce((sum, pair) => sum + pair[side].y, 0) / pairs.length,
  });
  const center = mean('from'),
    destination = mean('to');
  let energy = 0,
    dot = 0,
    cross = 0;
  for (const { from, to } of pairs) {
    const x = from.x - center.x,
      y = from.y - center.y;
    const u = to.x - destination.x,
      v = to.y - destination.y;
    energy += x * x + y * y;
    dot += x * u + y * v;
    cross += x * v - y * u;
  }
  // A small cluster cannot constrain a stable footpoint outside that cluster.
  if (energy / pairs.length < 36) return undefined;
  const a = dot / energy,
    b = cross / energy;
  const scale = Math.hypot(a, b);
  if (scale < 0.8 || scale > 1.25 || Math.abs(Math.atan2(b, a)) > 0.15)
    return undefined;
  const tx = destination.x - a * center.x + b * center.y;
  const ty = destination.y - b * center.x - a * center.y;
  let fitError = 0,
    translationError = 0;
  for (const { from, to } of pairs) {
    fitError +=
      (a * from.x - b * from.y + tx - to.x) ** 2 +
      (b * from.x + a * from.y + ty - to.y) ** 2;
    translationError +=
      (from.x + destination.x - center.x - to.x) ** 2 +
      (from.y + destination.y - center.y - to.y) ** 2;
  }
  // Prefer translation when a more complex fit only explains patch noise.
  if (
    fitError / pairs.length > 0.36 ||
    translationError / pairs.length < 0.0016 ||
    fitError > translationError * 0.6
  )
    return undefined;
  return { a, b, tx, ty, center, radius: Math.sqrt(energy / pairs.length) };
};

export const displacementAt = (
  motion: { dx: number; dy: number; transform?: SimilarityMotion },
  point: TrackPoint,
): TrackPoint => {
  const fit = motion.transform;
  if (
    !fit ||
    Math.hypot(point.x - fit.center.x, point.y - fit.center.y) > fit.radius * 4
  )
    return { x: motion.dx, y: motion.dy };
  return {
    x: fit.a * point.x - fit.b * point.y + fit.tx - point.x,
    y: fit.b * point.x + fit.a * point.y + fit.ty - point.y,
  };
};
