import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../shared/media/mediaTimeline';
import { getVideoJsPlayer } from '../../shared/videojs/videoJsAdapter';

/** Gaps still use elapsed time; active native media must finish loading/seeking. */
export const isPackageMediaBuffering = (
  angles: PackageMediaAngle[],
  syncData: VideoSyncData | undefined,
  time: number,
): boolean =>
  angles.some((angle, index) => {
    const active = resolveMediaTime(
      { clips: angle.clips, offsetSeconds: getAngleOffset(syncData, index) },
      time,
    );
    if (!active) return false;
    const video = getVideoJsPlayer(`video_${index}`)
      ?.el?.()
      ?.querySelector('video');
    // YouTube has no native video element in our document.
    if (!(video instanceof HTMLVideoElement) || video.ended || video.error)
      return false;
    return (
      video.seeking || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    );
  });
