import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../shared/media/mediaTimeline';
import { getVideoJsPlayer } from '../../shared/videojs/videoJsAdapter';

/** File playback waits for decode; gaps and capture MSE keep their own clock. */
export const isPackageMediaBuffering = (
  angles: PackageMediaAngle[],
  syncData: VideoSyncData | undefined,
  time: number,
): boolean =>
  angles.some((angle, index) => {
    const offsetSeconds = getAngleOffset(syncData, index);
    const active = resolveMediaTime(
      { clips: angle.clips, offsetSeconds },
      time,
    );
    if (!active) return false;
    const video = getVideoJsPlayer(`video_${index}`)
      ?.el?.()
      ?.querySelector('video');
    // YouTube has no native video element in our document.
    if (!(video instanceof HTMLVideoElement) || video.ended || video.error)
      return false;
    // MSE readiness can depend on the clock reaching the next recorded clip,
    // including a gap or short audio tail. Preserve its existing append/edge
    // clock; a failed MSE source falling back to a local file still waits here.
    if (
      angle.playbackFormat === 'fragmented-mp4' &&
      (video.currentSrc || video.src).startsWith('blob:')
    )
      return false;
    return (
      video.seeking || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    );
  });
