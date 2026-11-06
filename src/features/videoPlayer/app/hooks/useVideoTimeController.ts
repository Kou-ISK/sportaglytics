import { waitForVideoPresentation } from '../../../../shared/media/waitForVideoPresentation';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';
import { formatSource } from '../../../../shared/media/videoSource';
import {
  getAngleOffset,
  resolveMediaTime,
} from '../../../../shared/media/mediaTimeline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { VideoSeekMode } from '../../../../types/video/seek';
import {
  getVideoJsPlayer,
  setVideoJsPlayerCurrentTime,
} from '../../shared/videojs/videoJsAdapter';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import type { PackageMediaAngle } from '../../../../types/package/metadata';

type UseVideoTimeControllerParams = {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  syncMode: 'auto' | 'manual';
  mediaAngles: PackageMediaAngle[];
};

export const getMinAllowedGlobalTime = (
  syncData: VideoSyncData | undefined,
): number => {
  if (
    syncData &&
    syncData.isAnalyzed &&
    typeof syncData.syncOffset === 'number' &&
    syncData.syncOffset < 0
  ) {
    return syncData.syncOffset;
  }

  return 0;
};

const dispatchSeekEvent = (
  type: 'video-seek-start' | 'video-seek-end',
  time?: number,
  seekMode: VideoSeekMode = 'exact',
): void => {
  if (type === 'video-seek-start') {
    globalThis.window.dispatchEvent(
      new CustomEvent(type, { detail: { time, seekMode } }),
    );
    return;
  }

  globalThis.window.dispatchEvent(new CustomEvent(type));
};

const seekEachPlayer = ({
  timeClamped,
  videoList,
  syncData,
  isManualMode,
  mediaAngles,
}: {
  timeClamped: number;
  videoList: string[];
  syncData: VideoSyncData | undefined;
  isManualMode: boolean;
  mediaAngles: PackageMediaAngle[];
}): void => {
  videoList.forEach((_, index) => {
    // Clip-aware players own source resolution and coalesced seeks after React commits.
    if (!isManualMode && mediaAngles[index]?.clips.length) return;
    try {
      const player = getVideoJsPlayer(`video_${index}`);
      if (
        !player ||
        !player.el?.() ||
        player.isDisposed?.() === true ||
        player.error?.()
      ) {
        return;
      }

      let targetTime = timeClamped;
      const offset =
        index > 0 && syncData?.isAnalyzed && !isManualMode
          ? (syncData.angleOffsets?.[index] ?? syncData.syncOffset ?? 0)
          : 0;
      const durationCandidate = player.duration?.();
      const duration =
        typeof durationCandidate === 'number' &&
        !Number.isNaN(durationCandidate)
          ? durationCandidate
          : 0;

      if (!(duration > 0)) {
        return;
      }

      if (index === 0) {
        targetTime = Math.max(getMinAllowedGlobalTime(syncData), timeClamped);
      }

      if (index > 0 && syncData?.isAnalyzed && !isManualMode) {
        targetTime = Math.max(0, timeClamped + offset);
      }

      try {
        setVideoJsPlayerCurrentTime(player, targetTime);
      } catch (seekError) {
        console.debug(`Failed to seek video_${index}:`, seekError);
      }
    } catch (error) {
      console.debug(`Failed to process video_${index}:`, error);
    }
  });
};

export const useVideoTimeController = ({
  videoList,
  syncData,
  syncMode,
  mediaAngles,
}: UseVideoTimeControllerParams): {
  currentTime: number;
  playbackTime: number;
  seekReverse: (time: number, signal: AbortSignal) => Promise<void>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  handleCurrentTime: (
    event: SyntheticEvent | Event,
    newValue: number | number[],
    seekMode?: VideoSeekMode,
  ) => void;
} => {
  const [currentTime, setConfirmedTime] = useState(0);
  const [reverseDemand, setReverseDemand] = useState<number | null>(null);
  const reverseAbort = useRef<AbortController | null>(null);
  // Legacy polling reads currentTime immediately after assignment. While a held
  // seek owns presentation it cannot promote that unconfirmed value to tags.
  const setCurrentTime = useCallback<Dispatch<SetStateAction<number>>>(
    (value) => {
      if (!reverseAbort.current) setConfirmedTime(value);
    },
    [],
  );
  const seekOwner = useMemo(
    () => ({}),
    [videoList, syncData, syncMode, mediaAngles],
  );
  const currentOwner = useRef<object | null>(seekOwner);
  currentOwner.current = seekOwner;
  useEffect(() => {
    currentOwner.current = seekOwner;
    return () => {
      if (currentOwner.current === seekOwner) currentOwner.current = null;
      reverseAbort.current?.abort();
    };
  }, [seekOwner]);
  const pendingSeekRef = useRef<number | null>(null);
  const seekFrameRef = useRef<number | null>(null);
  const seekEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (seekFrameRef.current !== null)
        cancelAnimationFrame(seekFrameRef.current);
      if (seekEndTimerRef.current !== null)
        clearTimeout(seekEndTimerRef.current);
    },
    [],
  );

  const handleCurrentTime = useCallback(
    (
      _event: SyntheticEvent | Event,
      newValue: number | number[],
      seekMode: VideoSeekMode = 'exact',
    ): void => {
      // Unmount cleanup from an old timeline cannot seek a replacement source.
      if (currentOwner.current !== seekOwner) return;
      reverseAbort.current?.abort();
      reverseAbort.current = null;
      setReverseDemand(null);
      const time = typeof newValue === 'number' ? newValue : Number.NaN;
      const nativeOwned = getNativePlayback() !== null;
      const isManualMode = syncMode === 'manual';
      const minAllowed = getMinAllowedGlobalTime(syncData);

      if (!Number.isFinite(time) || time < minAllowed) {
        console.warn('Invalid time value:', time);
        if (!nativeOwned) setConfirmedTime(minAllowed);
        dispatchSeekEvent('video-seek-start', minAllowed);
        return;
      }

      const timeClamped = Math.max(time, minAllowed);
      // Coding/save/export use confirmed native time, never an unacknowledged
      // scrub target. The existing event carries demand to the native owner.
      if (!nativeOwned) setConfirmedTime(timeClamped);
      pendingSeekRef.current = nativeOwned ? null : timeClamped;
      if (nativeOwned && seekFrameRef.current !== null) {
        cancelAnimationFrame(seekFrameRef.current);
        seekFrameRef.current = null;
      }
      dispatchSeekEvent('video-seek-start', timeClamped, seekMode);

      if (!nativeOwned && seekFrameRef.current === null) {
        seekFrameRef.current = requestAnimationFrame(() => {
          seekFrameRef.current = null;
          const pendingTime = pendingSeekRef.current;
          if (pendingTime === null) return;
          pendingSeekRef.current = null;
          seekEachPlayer({
            timeClamped: pendingTime,
            videoList,
            syncData,
            isManualMode,
            mediaAngles,
          });
        });
      }

      if (seekEndTimerRef.current !== null)
        clearTimeout(seekEndTimerRef.current);
      seekEndTimerRef.current = setTimeout(() => {
        seekEndTimerRef.current = null;
        dispatchSeekEvent('video-seek-end');
      }, 120);
    },
    [mediaAngles, syncData, syncMode, videoList, seekOwner],
  );

  const seekReverse = useCallback(
    async (time: number, signal: AbortSignal): Promise<void> => {
      if (signal.aborted || currentOwner.current !== seekOwner)
        throw Error('REVERSE_CANCELLED');
      const abort = new AbortController();
      reverseAbort.current?.abort();
      reverseAbort.current = abort;
      pendingSeekRef.current = null;
      if (seekFrameRef.current !== null)
        cancelAnimationFrame(seekFrameRef.current);
      seekFrameRef.current = null;
      if (seekEndTimerRef.current !== null)
        clearTimeout(seekEndTimerRef.current);
      seekEndTimerRef.current = null;
      let started = false;
      const cancel = (): void => abort.abort();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const targets: VideoPresentationTarget[] = [];
        videoList.forEach((source, index) => {
          const offset = getAngleOffset(syncData, index);
          const clips = mediaAngles[index]?.clips;
          const resolved = clips?.length
            ? resolveMediaTime({ clips, offsetSeconds: offset }, time)
            : undefined;
          if (resolved === null) return; // A real timeline gap has no image to wait for.
          const video = getVideoJsPlayer(`video_${index}`)
            ?.el?.()
            ?.querySelector('video');
          if (!(video instanceof HTMLVideoElement))
            throw Error('REVERSE_VIDEO_UNAVAILABLE');
          targets.push({
            video,
            source: formatSource(resolved?.clip.source ?? source),
            time: resolved?.sourceTime ?? Math.max(0, time + offset),
            offset: resolved?.sourceTimeOffset ?? offset,
          });
        });
        const measured = await waitForVideoPresentation(
          targets,
          abort.signal,
          () => {
            setReverseDemand(time);
            started = true;
            dispatchSeekEvent('video-seek-start', time);
            seekEachPlayer({
              timeClamped: time,
              videoList,
              syncData,
              isManualMode: false,
              mediaAngles,
            });
          },
        );
        if (
          signal.aborted ||
          abort.signal.aborted ||
          currentOwner.current !== seekOwner
        )
          throw Error('REVERSE_CANCELLED');
        setConfirmedTime(measured ?? time);
      } finally {
        signal.removeEventListener('abort', cancel);
        if (reverseAbort.current === abort) {
          reverseAbort.current = null;
          setReverseDemand(null);
          if (started && currentOwner.current === seekOwner)
            dispatchSeekEvent('video-seek-end');
        }
      }
    },
    [mediaAngles, seekOwner, syncData, videoList],
  );
  return {
    currentTime,
    playbackTime: reverseDemand ?? currentTime,
    seekReverse,
    setCurrentTime,
    handleCurrentTime,
  };
};
