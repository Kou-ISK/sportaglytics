import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../shared/media/mediaTimeline';
import { resolveMediaDisplayTime } from '../../../../shared/media/mediaDisplayTime';
import { formatSource } from '../../../../shared/media/videoSource';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import type { VideoSyncData } from '../../../../types/video/sync';
import { getVideoJsPlayer } from '../../shared/videojs/videoJsAdapter';

export const videoPresentationTargets = (
  time: number,
  videoList: readonly string[],
  mediaAngles: readonly PackageMediaAngle[],
  syncData: VideoSyncData | undefined,
  includeEnd: boolean,
): VideoPresentationTarget[] | null => {
  const targets: VideoPresentationTarget[] = [];
  for (const [index, source] of videoList.entries()) {
    if (!source.trim()) continue;
    const offset = getAngleOffset(syncData, index);
    const clips = mediaAngles[index]?.clips;
    const resolve = includeEnd ? resolveMediaDisplayTime : resolveMediaTime;
    const resolved = clips?.length
      ? resolve({ clips, offsetSeconds: offset }, time)
      : undefined;
    if (resolved === null) continue; // This angle is intentionally blank.
    const video = getVideoJsPlayer(`video_${index}`)
      ?.el?.()
      ?.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return null;
    targets.push({
      video,
      source: formatSource(resolved?.clip.source ?? source),
      time: resolved?.sourceTime ?? Math.max(0, time + offset),
      offset: resolved?.sourceTimeOffset ?? offset,
    });
  }
  return targets;
};

/** A clip after a gap has no video element until React mounts it. */
export const waitForMountedTargets = (
  read: () => VideoPresentationTarget[] | null,
  signal: AbortSignal,
): Promise<VideoPresentationTarget[]> =>
  new Promise((resolve, reject) => {
    let frame = 0;
    const cleanup = (): void => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      signal.removeEventListener('abort', fail);
    };
    const fail = (): void => {
      cleanup();
      reject(Error('SCRUB_VIDEO_UNAVAILABLE'));
    };
    const check = (): void => {
      const targets = read();
      if (targets) {
        cleanup();
        resolve(targets);
      } else frame = requestAnimationFrame(check);
    };
    const timer = setTimeout(fail, 5000);
    signal.addEventListener('abort', fail, { once: true });
    if (signal.aborted) fail();
    else check();
  });

/** Warm primary plus a newly entering local secondary, never arbitrary source
 * switches, preloaded angles, a single angle or multiple clips. Resolution
 * uses the same clip/offset mapping as the normal paired presentation proof.
 */
export const entersColdSecondAngle = (
  before: number,
  target: number,
  videoList: readonly string[],
  mediaAngles: readonly PackageMediaAngle[],
  syncData: VideoSyncData | undefined,
): boolean => {
  if (
    videoList.length !== 2 ||
    mediaAngles.length !== 2 ||
    !videoList.every((s) => s.trim()) ||
    !mediaAngles.every((a) => a.clips.length === 1)
  )
    return false;
  const angle = (t: number, i: number) =>
    videoPresentationTargets(
      t,
      videoList.map((src, n) => (n === i ? src : '')),
      mediaAngles,
      syncData,
      true,
    );
  if (angle(before, 1)?.length !== 0) return false;
  const a = angle(target, 0);
  const c = angle(target, 1);
  const ready = (target: VideoPresentationTarget) =>
    target.video.currentSrc === target.source && target.video.readyState >= 2;
  return (
    a?.length === 1 &&
    ready(a[0]) &&
    (c === null || (c.length === 1 && !ready(c[0])))
  );
};
