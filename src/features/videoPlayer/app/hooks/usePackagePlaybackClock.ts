import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/media';
import type { VideoSyncData } from '../../../../types/video/sync';
import {
  getAngleOffset,
  getMediaTimelineEnd,
} from '../../../../shared/media/mediaTimeline';

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
} => {
  const useTimelineClock =
    syncMode === 'auto' && mediaAngles.some((angle) => angle.clips.length > 0);
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
  const clock = useRef(currentTime);
  clock.current = currentTime;
  useEffect(() => {
    if (useTimelineClock && timelineEnd > 0) setMaxSec(timelineEnd);
  }, [useTimelineClock, timelineEnd, setMaxSec]);
  useEffect(() => {
    if (!useTimelineClock || !isVideoPlaying) return;
    let frame = 0;
    let previous: number | undefined;
    const advance = (timestamp: number): void => {
      if (previous !== undefined) {
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
      previous = timestamp;
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
  ]);
  return { useTimelineClock, timelineEnd };
};
