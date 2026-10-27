import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../shared/media/mediaTimeline';
import { getRangePlaybackClock } from '../../shared/playbackRanges/rangePlaybackRegistry';
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
    if (!(video instanceof HTMLVideoElement)) return false;
    const ranges = getRangePlaybackClock(video);
    if (ranges) {
      ranges.demand(active.sourceTime);
      // A requested fallback is not an original-return acknowledgement. The
      // transport holds the common clock until its binding is replaced/removed.
      return (
        !!ranges.failure ||
        !!video.error ||
        !ranges.isReady(active.sourceTime, video)
      );
    }
    if (video.ended || video.error) return false;
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

/** Paused seeks must request missing ranges without waiting for a playing rAF. */
export const demandPackagePlaybackRanges = (
  angles: PackageMediaAngle[],
  syncData: VideoSyncData | undefined,
  time: number,
  seek: boolean,
): void => {
  angles.forEach((angle, index) => {
    const active = resolveMediaTime(
      { clips: angle.clips, offsetSeconds: getAngleOffset(syncData, index) },
      time,
    );
    if (!active) return;
    const video = getVideoJsPlayer(`video_${index}`)
      ?.el?.()
      ?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return;
    const ranges = getRangePlaybackClock(video);
    if (seek) ranges?.seek(active.sourceTime);
    else ranges?.demand(active.sourceTime);
  });
};
