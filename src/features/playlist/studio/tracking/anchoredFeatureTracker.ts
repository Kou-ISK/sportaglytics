import { trackFeatures } from './featureTracker';
import type { FeatureMotion } from './featureTracker';
import { displacementAt } from './featureMotionModel';
import type { GrayFrame, TrackPoint } from './templateTracker';

/** Periodic reference matching bounds integration error without forcing a lost target. */
export const createAnchoredFeatureTracker = (
  initialFrame: GrayFrame,
  initialPoints: TrackPoint[],
  attachment: TrackPoint,
): {
  advance: (
    frame: GrayFrame,
    next: GrayFrame,
    points: TrackPoint[],
    prediction: TrackPoint,
  ) => FeatureMotion;
  position: () => TrackPoint;
} => {
  let travel = { x: 0, y: 0 };
  let reference = {
    frame: initialFrame,
    points: initialPoints,
    travel,
    age: 0,
  };
  return {
    position: () => travel,
    advance: (frame, next, points, prediction) => {
      const match = trackFeatures(frame, next, points, prediction);
      if (!match.reliable) return match;
      const motion = displacementAt(match, {
        x: attachment.x + travel.x,
        y: attachment.y + travel.y,
      });
      let nextTravel = { x: travel.x + motion.x, y: travel.y + motion.y };
      reference.age += 1;
      if (reference.age % 5 === 0 && reference.points.length >= 4) {
        const relative = {
          x: nextTravel.x - reference.travel.x,
          y: nextTravel.y - reference.travel.y,
        };
        const anchored = trackFeatures(
          reference.frame,
          next,
          reference.points,
          relative,
        );
        const offset = displacementAt(anchored, {
          x: attachment.x + reference.travel.x,
          y: attachment.y + reference.travel.y,
        });
        if (
          anchored.reliable &&
          anchored.confidence >= 0.85 &&
          anchored.points.length >= 4 &&
          Math.hypot(offset.x - relative.x, offset.y - relative.y) <= 2.5
        ) {
          nextTravel = {
            x: reference.travel.x + offset.x,
            y: reference.travel.y + offset.y,
          };
        }
      }
      travel = nextTravel;
      if (
        reference.age >= 15 &&
        match.confidence >= 0.85 &&
        match.points.length >= 4
      ) {
        reference = { frame: next, points: match.points, travel, age: 0 };
      }
      return match;
    },
  };
};
