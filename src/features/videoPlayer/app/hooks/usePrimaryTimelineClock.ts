import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaClip } from '../../../../types/package/metadata';
import {
  advancePrimaryTimelineClock,
  arePrimaryTimelineDurationsKnown,
  calculatePrimaryTimelineEnd,
} from './primaryTimelineClock';

interface UsePrimaryTimelineClockParams {
  enabled: boolean;
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  currentTime: number;
  clips: PackageMediaClip[];
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  setMaxSec: Dispatch<SetStateAction<number>>;
}

interface UsePrimaryTimelineClockResult {
  onPrimaryPlaybackTimeChange: (timeSeconds: number) => void;
  onPrimaryPlaybackEnded: () => void;
}

export const usePrimaryTimelineClock = ({
  enabled,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  clips,
  setCurrentTime,
  setIsVideoPlaying,
  setMaxSec,
}: UsePrimaryTimelineClockParams): UsePrimaryTimelineClockResult => {
  const currentTimeRef = useRef(currentTime);
  const primaryTimelineEnd = useMemo(
    () => calculatePrimaryTimelineEnd(clips),
    [clips],
  );
  const durationsKnown = useMemo(
    () => arePrimaryTimelineDurationsKnown(clips),
    [clips],
  );

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (enabled && primaryTimelineEnd > 0) {
      setMaxSec((value) => Math.max(value, primaryTimelineEnd));
    }
  }, [enabled, primaryTimelineEnd, setMaxSec]);

  const commitGlobalTime = useCallback(
    (nextGlobalTime: number): void => {
      const currentGlobalTime = currentTimeRef.current;
      const boundedTime =
        durationsKnown &&
        primaryTimelineEnd > 0 &&
        nextGlobalTime >= primaryTimelineEnd
          ? primaryTimelineEnd
          : nextGlobalTime;

      if (Math.abs(boundedTime - currentGlobalTime) > 0.001) {
        currentTimeRef.current = boundedTime;
        setCurrentTime(boundedTime);
      }

      if (
        durationsKnown &&
        primaryTimelineEnd > 0 &&
        boundedTime >= primaryTimelineEnd
      ) {
        setIsVideoPlaying(false);
      }
    }, [
      durationsKnown,
      primaryTimelineEnd,
      setCurrentTime,
      setIsVideoPlaying,
    ],
  );

  const onPrimaryPlaybackTimeChange = useCallback(
    (timeSeconds: number): void => {
      if (!enabled || !isVideoPlaying) {
        return;
      }

      const nextGlobalTime = advancePrimaryTimelineClock({
        currentGlobalTime: currentTimeRef.current,
        elapsedSeconds: 0,
        playbackRate: videoPlayBackRate,
        clips,
        observedPrimaryMediaTime: timeSeconds,
      });
      commitGlobalTime(nextGlobalTime);
    }, [
      clips,
      commitGlobalTime,
      enabled,
      isVideoPlaying,
      videoPlayBackRate,
    ],
  );

  const onPrimaryPlaybackEnded = useCallback((): void => {
    if (!enabled || !isVideoPlaying) {
      return;
    }

    const nextGlobalTime = advancePrimaryTimelineClock({
      currentGlobalTime: currentTimeRef.current,
      elapsedSeconds: 0,
      playbackRate: videoPlayBackRate,
      clips,
      observedPrimaryMediaTime: null,
      observedPrimaryMediaEnded: true,
    });
    commitGlobalTime(nextGlobalTime);
  }, [
    clips,
    commitGlobalTime,
    enabled,
    isVideoPlaying,
    videoPlayBackRate,
  ]);

  useEffect(() => {
    if (!enabled || !isVideoPlaying) {
      return;
    }

    let animationFrameId = 0;
    let previousTimestamp: number | undefined;

    const updateGapClock = (timestamp: number): void => {
      if (previousTimestamp !== undefined) {
        const elapsedSeconds =
          Math.max(0, timestamp - previousTimestamp) / 1000;
        const nextGlobalTime = advancePrimaryTimelineClock({
          currentGlobalTime: currentTimeRef.current,
          elapsedSeconds,
          playbackRate: videoPlayBackRate,
          clips,
          observedPrimaryMediaTime: null,
        });
        commitGlobalTime(nextGlobalTime);
      }

      previousTimestamp = timestamp;
      animationFrameId = globalThis.requestAnimationFrame(updateGapClock);
    };

    animationFrameId = globalThis.requestAnimationFrame(updateGapClock);
    return () => globalThis.cancelAnimationFrame(animationFrameId);
  }, [
    clips,
    commitGlobalTime,
    enabled,
    isVideoPlaying,
    videoPlayBackRate,
  ]);

  return {
    onPrimaryPlaybackTimeChange,
    onPrimaryPlaybackEnded,
  };
};
