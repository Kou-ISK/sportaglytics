import { useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaClip } from '../../../../types/package/metadata';
import {
  getVideoJsPlayer,
  getVideoJsPlayerCurrentTime,
  type VideoJsPlayerHandle,
} from '../../shared/videojs/videoJsAdapter';
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

export const usePrimaryTimelineClock = ({
  enabled,
  isVideoPlaying,
  videoPlayBackRate,
  currentTime,
  clips,
  setCurrentTime,
  setIsVideoPlaying,
  setMaxSec,
}: UsePrimaryTimelineClockParams): void => {
  const currentTimeRef = useRef(currentTime);
  const consumedEndedPlayersRef = useRef<WeakSet<VideoJsPlayerHandle>>(
    new WeakSet(),
  );
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

  useEffect(() => {
    if (!enabled || !isVideoPlaying) {
      return;
    }

    let animationFrameId = 0;
    let previousTimestamp: number | undefined;

    const updateClock = (timestamp: number): void => {
      if (previousTimestamp !== undefined) {
        const elapsedSeconds =
          Math.max(0, timestamp - previousTimestamp) / 1000;
        const currentGlobalTime = currentTimeRef.current;
        const primaryPlayer = getVideoJsPlayer('video_0');
        const observedPrimaryMediaTime = primaryPlayer
          ? getVideoJsPlayerCurrentTime(primaryPlayer)
          : null;
        const playerEnded = primaryPlayer?.ended?.() === true;
        const shouldConsumeEnded =
          primaryPlayer !== undefined &&
          playerEnded &&
          !consumedEndedPlayersRef.current.has(primaryPlayer);

        if (shouldConsumeEnded && primaryPlayer) {
          consumedEndedPlayersRef.current.add(primaryPlayer);
        }

        const nextGlobalTime = advancePrimaryTimelineClock({
          currentGlobalTime,
          elapsedSeconds,
          playbackRate: videoPlayBackRate,
          clips,
          observedPrimaryMediaTime,
          observedPrimaryMediaEnded: shouldConsumeEnded,
        });
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
          return;
        }
      }

      previousTimestamp = timestamp;
      animationFrameId = globalThis.requestAnimationFrame(updateClock);
    };

    animationFrameId = globalThis.requestAnimationFrame(updateClock);
    return () => globalThis.cancelAnimationFrame(animationFrameId);
  }, [
    clips,
    durationsKnown,
    enabled,
    isVideoPlaying,
    primaryTimelineEnd,
    setCurrentTime,
    setIsVideoPlaying,
    videoPlayBackRate,
  ]);
};
