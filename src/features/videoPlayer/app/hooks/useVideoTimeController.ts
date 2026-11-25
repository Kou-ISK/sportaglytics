import { ColdScrubPair } from './coldScrubPair';
import { useScrubPreview } from './useScrubPreview';
import { TimelineScrub } from '../../../../shared/media/timelineScrub';
import {
  entersColdSecondAngle,
  videoPresentationTargets,
  waitForMountedTargets,
} from './videoPresentationTargets';
import { waitForVideoPresentation } from '../../../../shared/media/waitForVideoPresentation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { VideoSeekMode } from '../../../../types/video/seek';
import {
  getVideoJsPlayer,
  setVideoJsPlayerCurrentTime,
} from '../../shared/videojs/videoJsAdapter';
import {
  getNativePlayback,
  subscribeNativePlayback,
} from '../../shared/nativePlayback/nativePlaybackRegistry';
import type { PackageMediaAngle } from '../../../../types/package/metadata';

type UseVideoTimeControllerParams = {
  dualView?: boolean;
  onScrubFailure?: () => void;
  isVideoPlaying?: boolean;
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
  reverse = false,
): void => {
  if (type === 'video-seek-start') {
    globalThis.window.dispatchEvent(
      new CustomEvent(type, { detail: { time, seekMode, reverse } }),
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
  dualView = true,
  onScrubFailure,
  isVideoPlaying,
  videoList,
  syncData,
  syncMode,
  mediaAngles,
}: UseVideoTimeControllerParams): {
  currentTime: number;
  playbackTime: number;
  scrubbing: boolean;
  maskedScrubAngles: readonly number[];
  seekReverse: (time: number, signal: AbortSignal) => Promise<number | null>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  handleCurrentTime: (
    event: SyntheticEvent | Event,
    newValue: number | number[],
    seekMode?: VideoSeekMode,
  ) => void;
} => {
  const failedScrub = useRef(false);
  useEffect(() => {
    if (isVideoPlaying) failedScrub.current = false;
  }, [isVideoPlaying]);
  const [currentTime, setConfirmedTime] = useState(0);
  const [reverseDemand, setReverseDemand] = useState<number | null>(null);
  const [scrubDemand, setScrubDemand] = useState<number | null>(null);
  const [maskedScrubAngles, setMaskedScrubAngles] = useState<readonly number[]>([]);
  const cold = useRef<ColdScrubPair | null>(null);
  const preview = useScrubPreview(
    videoList,
    mediaAngles,
    syncData,
    syncMode,
    currentTime,
    !!isVideoPlaying || scrubDemand !== null,
  );
  const previewRevision = useRef(0);
  const scrub = useRef<TimelineScrub | null>(null);
  const nativeDrag = useRef<{
    owner: NonNullable<ReturnType<typeof getNativePlayback>>;
    input: string;
    revision: number;
  } | null>(null);
  const cancelScrub = useCallback(() => {
    previewRevision.current++;
    preview.current?.end();
    if (!scrub.current) return;
    cold.current?.cancel();
    cold.current = null;
    setMaskedScrubAngles([]);
    scrub.current.cancel();
    scrub.current = null;
    setScrubDemand(null);
  }, [preview]);
  const reverseAbort = useRef<AbortController | null>(null);
  const reverseAbortOwner = useRef<object | null>(null);
  // Legacy polling reads currentTime immediately after assignment. While a held
  // seek owns presentation it cannot promote that unconfirmed value to tags.
  const setCurrentTime = useCallback<Dispatch<SetStateAction<number>>>(
    (value) => {
      if (!reverseAbort.current && !scrub.current && !failedScrub.current) setConfirmedTime(value);
    },
    [],
  );
  const seekOwner = useMemo(
    () => ({}),
    [videoList, syncData, syncMode, mediaAngles, dualView],
  );
  const currentOwner = useRef<object | null>(seekOwner);
  currentOwner.current = seekOwner;
  useEffect(() => {
    currentOwner.current = seekOwner;
    failedScrub.current = false;
    return () => {
      if (currentOwner.current === seekOwner) currentOwner.current = null;
      if (reverseAbortOwner.current === seekOwner)
        reverseAbort.current?.abort();
    };
  }, [seekOwner]);
  useLayoutEffect(() => () => cancelScrub(), [seekOwner, cancelScrub]);
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

  const presentPosition = useCallback(
    async (
      time: number,
      signal: AbortSignal,
      timeline = false,
    ): Promise<number | null> => {
      if (signal.aborted || currentOwner.current !== seekOwner)
        throw Error('REVERSE_CANCELLED');
      const abort = new AbortController();
      reverseAbort.current?.abort();
      reverseAbort.current = abort;
      reverseAbortOwner.current = seekOwner;
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
        const readTargets = () =>
          videoPresentationTargets(
            time,
            videoList,
            mediaAngles,
            syncData,
            timeline,
          );
        let targets = readTargets();
        if (!targets) {
          if (!timeline) throw Error('REVERSE_VIDEO_UNAVAILABLE');
          setScrubDemand(time);
          targets = await waitForMountedTargets(readTargets, abort.signal);
        }
        const measured = await waitForVideoPresentation(
          targets,
          abort.signal,
          () => {
            if (timeline) setScrubDemand(time);
            else setReverseDemand(time);
            started = true;
            dispatchSeekEvent('video-seek-start', time, 'exact', true);
            seekEachPlayer({
              timeClamped: time,
              videoList,
              syncData,
              isManualMode: false,
              mediaAngles,
            });
          },
          timeline,
        );
        if (
          signal.aborted ||
          abort.signal.aborted ||
          currentOwner.current !== seekOwner
        )
          throw Error('REVERSE_CANCELLED');
        if (!timeline) setConfirmedTime(measured ?? time);
        return measured;
      } finally {
        signal.removeEventListener('abort', cancel);
        if (reverseAbort.current === abort) {
          reverseAbort.current = null;
          reverseAbortOwner.current = null;
          setReverseDemand(null);
          if (started && currentOwner.current === seekOwner)
            dispatchSeekEvent('video-seek-end');
        }
      }
    },
    [mediaAngles, seekOwner, syncData, videoList],
  );
  const seekReverse = useCallback(
    (time: number, signal: AbortSignal): Promise<number | null> => {
      cancelScrub();
      failedScrub.current = false;
      return presentPosition(time, signal);
    },
    [cancelScrub, presentPosition],
  );
  useEffect(() => {
    const finish = (): void => {
      if (scrub.current?.input === 'timeline-window-seek') {
        previewRevision.current++;
        preview.current?.end();
        scrub.current.finishPreview();
      }
    };
    window.addEventListener('timeline-window-preview-end', finish);
    const unsubscribe = subscribeNativePlayback(() => {
      if (getNativePlayback()) cancelScrub();
    });
    return () => {
      unsubscribe();
      window.removeEventListener('timeline-window-preview-end', finish);
    };
  }, [cancelScrub, preview]);
  const handleCurrentTime = useCallback(
    (
      _event: SyntheticEvent | Event,
      newValue: number | number[],
      seekMode: VideoSeekMode = 'exact',
    ): void => {
      // Unmount cleanup from an old timeline cannot seek a replacement source.
      if (currentOwner.current !== seekOwner) return;
      const native = getNativePlayback();
      const nativeOwned = native !== null;
      const drag = nativeDrag.current;
      if (
        native &&
        seekMode === 'scrub' &&
        (drag?.input !== _event.type ||
          drag.owner !== native ||
          drag.revision !== native.seekRevision)
      )
        return;
      if (seekMode !== 'preview') nativeDrag.current = null;
      const time = typeof newValue === 'number' ? newValue : Number.NaN;
      const supportsScrub =
        syncMode === 'auto' &&
        !nativeOwned &&
        videoList.some((source) => source.trim()) &&
        videoList.every((source) => !/^https?:/i.test(source)) &&
        mediaAngles.every(
          (angle) =>
            angle.sourceKind === 'local' &&
            angle.playbackFormat !== 'fragmented-mp4',
        );
      if (
        Number.isFinite(time) &&
        time >= getMinAllowedGlobalTime(syncData) &&
        seekMode !== 'exact' &&
        supportsScrub
      ) {
        if (seekMode === 'scrub' && scrub.current?.input !== _event.type)
          return;
        if (scrub.current && scrub.current.input !== _event.type) {
          cancelScrub();
        }
        previewRevision.current++;
        if (seekMode === 'scrub') preview.current?.end();
        else preview.current?.request(time);
        if (!cold.current && dualView && entersColdSecondAngle(currentTime, time, videoList, mediaAngles, syncData)) {
          cold.current = new ColdScrubPair(time);
          setMaskedScrubAngles([1]);
        }
        if (!scrub.current) {
          let failedLayer: typeof preview.current = null;
          const gesture = new TimelineScrub(
            _event.type,
            async (target, signal, final) => {
              const layer = preview.current;
              if (!final && layer && layer !== failedLayer && !getNativePlayback()) {
                const revision = previewRevision.current;
                setScrubDemand((previous) => previous ?? layer.video.currentTime);
                const pts = await layer.draw(target, signal).catch(() => null);
                if (revision !== previewRevision.current) {
                  // An expired/slow preview must not starve original seeks.
                  if (pts === null) failedLayer = layer;
                  return undefined;
                }
                if (pts !== null) return pts;
                layer.end();
              }
              const pair = cold.current;
              if (!pair) {
                const measured = await presentPosition(target, signal, true);
                // A gesture may start in the gap, then enter the secondary clip
                // while its primary-only proof is still pending.
                return cold.current ? undefined : measured;
              }
              const measured = await pair.present(target, signal, (t, s) => presentPosition(t, s, true));
              if (measured === undefined || cold.current !== pair) return undefined;
              cold.current = null;
              setMaskedScrubAngles([]);
              return measured;
            },
            (confirmed) => {
              if (currentOwner.current === seekOwner)
                setConfirmedTime(confirmed);
            },
            (failed) => {
              if (scrub.current !== gesture) return;
              failedScrub.current = failed;
              if (failed) onScrubFailure?.();
              cancelScrub();
            },
          );
          scrub.current = gesture;
        }
        cold.current?.request(time);
        scrub.current.request(time, seekMode === 'scrub');
        return;
      }
      failedScrub.current = false;
      cancelScrub();
      reverseAbort.current?.abort();
      reverseAbort.current = null;
      reverseAbortOwner.current = null;
      setReverseDemand(null);
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
      if (native && seekMode === 'preview') {
        nativeDrag.current = {
          owner: native,
          input: _event.type,
          revision: native.seekRevision,
        };
      }

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
    [
      mediaAngles,
      syncData,
      syncMode,
      videoList,
      seekOwner,
      presentPosition,
      onScrubFailure,
      dualView,
      currentTime,
      preview,
      cancelScrub,
    ],
  );

  return {
    currentTime,
    playbackTime: scrubDemand ?? reverseDemand ?? currentTime,
    scrubbing: scrubDemand !== null,
    maskedScrubAngles,
    seekReverse,
    setCurrentTime,
    handleCurrentTime,
  };
};
