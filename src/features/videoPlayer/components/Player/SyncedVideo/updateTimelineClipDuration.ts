import { withClipDuration } from '../../../../../shared/media/withClipDuration';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';

export const updateTimelineClipDuration = (
  angles: PackageMediaAngle[],
  index: number,
  clipId: string,
  duration: number,
): PackageMediaAngle[] => {
  const angle = angles[index];
  if (!angle) return angles;
  const clips = withClipDuration(angle.clips, clipId, duration);
  if (clips === angle.clips) return angles;
  return angles.map((item, i) => (i === index ? { ...item, clips } : item));
};
