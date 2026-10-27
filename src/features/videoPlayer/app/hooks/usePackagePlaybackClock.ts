import { formatSource } from '../../../../shared/media/videoSource';
import { useNativePackageClock } from './useNativePackageClock';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  getAngleOffset,
  getMediaTimelineEnd,
} from '../../../../shared/media/mediaTimeline';
import {
  isPackageMediaBuffering,
  demandPackagePlaybackRanges,
} from './packagePlaybackReadiness';

interface PackagePlaybackClockParams {
  mediaAngles: PackageMediaAngle[];
  syncData?: VideoSyncData;
  syncMode: 'auto' | 'manual';
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  currentTime: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  setMaxSec: Dispatch<SetStateAction<number>>;
  livePlaybackEnd?: number;
}

/** The package clock survives file boundaries and waits for captured media without entering a gap. */
export const usePackagePlaybackClock = ({
  mediaAngles,
  syncData,
  syncMode,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  setCurrentTime,
  setIsVideoPlaying,
  setMaxSec,
  livePlaybackEnd,
}: PackagePlaybackClockParams): {
  useTimelineClock: boolean;
  timelineEnd: number;
  holdPlayback: boolean;
} => {
  const soleClip =
    mediaAngles.length === 1 && mediaAngles[0].clips.length === 1
      ? mediaAngles[0].clips[0]
      : null;
  const nativeOwned = useNativePackageClock(
    syncMode === 'auto' &&
      livePlaybackEnd === undefined &&
      soleClip?.sourceKind === 'local' &&
      soleClip.timelineStartSeconds === 0 &&
      getAngleOffset(syncData, 0) === 0
      ? formatSource(soleClip.source)
      : null,
    isVideoPlaying,
    videoPlayBackRate,
    setCurrentTime,
    setIsVideoPlaying,
  );
  const [mediaBuffering, setMediaBuffering] = useState(false);
  const bufferingRef = useRef(false);
  const useTimelineClock =
    nativeOwned ||
    (syncMode === 'auto' &&
      mediaAngles.some((angle) => angle.clips.length > 0));
  const timelineEnd = useMemo(
    () =>
      Math.max(
        0,
        ...mediaAngles.map((angle, index) =>
          getMediaTimelineEnd({
            clips: angle.clips,
            offsetSeconds: getAngleOffset(syncData, index),
          }),
        ),
      ),
    [mediaAngles, syncData],
  );
  const durationsKnown = useMemo(
    () =>
      mediaAngles.every((angle) =>
        angle.clips.every((clip) => typeof clip.durationSeconds === 'number'),
      ),
    [mediaAngles],
  );
  const bounds = useRef({ livePlaybackEnd, timelineEnd, durationsKnown });
  bounds.current = { livePlaybackEnd, timelineEnd, durationsKnown };
  const media = useRef({ mediaAngles, syncData });
  media.current = { mediaAngles, syncData };
  const clock = useRef(currentTime);
  useLayoutEffect(() => {
    // Playing timeline demands come from the authoritative rAF/seek clock.
    // A delayed React commit must not bring range eviction/read back in time.
    if (getNativePlayback() || (isVideoPlaying && useTimelineClock)) return;
    demandPackagePlaybackRanges(
      mediaAngles,
      syncData,
      currentTime,
      !isVideoPlaying,
    );
  }, [mediaAngles, syncData, currentTime, isVideoPlaying, useTimelineClock]);
  // A delayed React commit may still contain an older tick. Never feed it back
  // into the running clock: that slows playback and forces repeated video seeks.
  useLayoutEffect(() => {
    // Native observations (including the final stopped time) are authoritative
    // while native owns playback. Seed the next HTML rAF before releasing it.
    if (nativeOwned || !isVideoPlaying || !useTimelineClock)
      clock.current = currentTime;
  }, [currentTime, isVideoPlaying, useTimelineClock, nativeOwned]);
  useEffect(() => {
    const seek = (event: Event): void => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : null;
      if (typeof detail !== 'object' || detail === null || !('time' in detail))
        return;
      if (typeof detail.time === 'number' && Number.isFinite(detail.time)) {
        const requested = Math.max(-86400, Math.min(86400, detail.time));
        const native = getNativePlayback();
        if (native) {
          native.seek(
            requested,
            'seekMode' in detail &&
              (detail.seekMode === 'preview' || detail.seekMode === 'scrub')
              ? detail.seekMode
              : 'exact',
          );
          return;
        }
        clock.current = requested;
        demandPackagePlaybackRanges(
          media.current.mediaAngles,
          media.current.syncData,
          clock.current,
          true,
        );
      }
    };
    window.addEventListener('video-seek-start', seek);
    return () => window.removeEventListener('video-seek-start', seek);
  }, []);
  useEffect(() => {
    if (useTimelineClock && timelineEnd > 0) setMaxSec(timelineEnd);
  }, [useTimelineClock, timelineEnd, setMaxSec]);
  useEffect(() => {
    if (nativeOwned || !useTimelineClock || !isVideoPlaying) return;
    let frame = 0;
    let previous: number | undefined;
    const advance = (timestamp: number): void => {
      if (getNativePlayback()) return;
      const buffering = isPackageMediaBuffering(
        media.current.mediaAngles,
        media.current.syncData,
        clock.current,
      );
      if (bufferingRef.current !== buffering) {
        bufferingRef.current = buffering;
        setMediaBuffering(buffering);
      }
      if (previous !== undefined && !buffering) {
        const { livePlaybackEnd, timelineEnd, durationsKnown } = bounds.current;
        const next = Math.min(
          86400,
          clock.current +
            (Math.max(0, timestamp - previous) / 1000) * videoPlayBackRate,
        );
        if (livePlaybackEnd !== undefined) {
          // Keep the last frame instead of seeking into an unfinished file. A later
          // segment update increases the limit; deliberate pause still stops this effect.
          clock.current = Math.max(
            clock.current,
            Math.min(next, Math.max(0, livePlaybackEnd - 0.1)),
          );
        } else if (durationsKnown && timelineEnd > 0 && next >= timelineEnd) {
          clock.current = timelineEnd;
          setIsVideoPlaying(false);
        } else clock.current = next;
        setCurrentTime(clock.current);
      }
      // Discard the waiting interval. Catching up to wall time would immediately
      // seek past the decoded frame and start another expensive decode.
      previous = buffering ? undefined : timestamp;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [
    isVideoPlaying,
    setCurrentTime,
    setIsVideoPlaying,
    useTimelineClock,
    videoPlayBackRate,
    nativeOwned,
  ]);
  return {
    useTimelineClock,
    timelineEnd,
    holdPlayback:
      nativeOwned || (useTimelineClock && isVideoPlaying && mediaBuffering),
  };
};
