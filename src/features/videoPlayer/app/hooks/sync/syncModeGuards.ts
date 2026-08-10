import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import { usesVirtualClipTimeline } from '../../../../../types/package/clipTimeline';

/**
 * Legacy angle-level synchronization is only meaningful while the first two
 * angles are direct media timelines. Once either angle uses absolute clip
 * placement, clip timeline synchronization is the source of truth.
 */
export const usesClipPlacementSync = (
  mediaAngles: PackageMediaAngle[],
): boolean =>
  mediaAngles
    .slice(0, 2)
    .some((angle) => usesVirtualClipTimeline(angle.clips));
