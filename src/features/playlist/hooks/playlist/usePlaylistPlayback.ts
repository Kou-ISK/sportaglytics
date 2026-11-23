import { useSlideClock } from './useSlideClock';
import { TimelineScrub } from '../../../../shared/media/timelineScrub';
import { waitForVideoPresentation } from '../../../../shared/media/waitForVideoPresentation';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';
import { formatSource } from '../../../../shared/media/videoSource';
import { usePlaylistMediaTimeline } from '../../media/usePlaylistMediaTimeline';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePlaylistPlaybackActions } from './usePlaylistPlaybackActions';
import { usePlaylistPlaybackEffects } from './usePlaylistPlaybackEffects';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

export const usePlaylistPlayback = (params: UsePlaylistPlaybackParams) => {
  const scrub = useRef<TimelineScrub | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const failedTime = useRef<number | null>(null);
  const requested = useRef(0);
  const [scrubError, setScrubError] = useState('');
  const playing = params.isPlaying && !scrubbing && !scrubError;
  const reverseAbort = useRef<AbortController | null>(null);
  const reverseAbortOwner = useRef<object | null>(null);
  const lastFreezeTimestampRef = useRef<number | null>(null);
  const freezeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
    },
    [],
  );

  const timelineCallbacks = useRef({
    onTime: (_time: number): void => undefined,
    onEnd: (): void => undefined,
  });
  const mediaTimeline = usePlaylistMediaTimeline(
    { ...params, isPlaying: playing },
    timelineCallbacks,
  );
  const seekOwner = useMemo(
    () => ({}),
    [
      params.currentItem?.id,
      params.currentItem?.startTime,
      params.currentItem?.endTime,
      params.currentVideoSource,
      params.currentVideoSource2,
      params.viewMode,
      params.workspaceMode,
      mediaTimeline.timelineOwner,
    ],
  );
  const currentOwner = useRef<object | null>(seekOwner);
  currentOwner.current = seekOwner;
  const actions = usePlaylistPlaybackActions({
    seekMedia: mediaTimeline.seek,
    documentGeneration: params.documentGeneration,
    items: params.items,
    currentItem: params.currentItem,
    currentIndex: params.currentIndex,
    setCurrentIndex: params.setCurrentIndex,
    setCurrentTime: params.setCurrentTime,
    isPlaying: params.isPlaying,
    setIsPlaying: params.setIsPlaying,
    isFrozen: params.isFrozen,
    setIsFrozen: params.setIsFrozen,
    autoAdvance: params.autoAdvance,
    loopPlaylist: params.loopPlaylist,
    currentVideoSource2: params.currentVideoSource2,
    videoRef: params.videoRef,
    videoRef2: params.videoRef2,
    setVolume: params.setVolume,
    containerRef: params.containerRef,
    isFullscreen: params.isFullscreen,
    setIsFullscreen: params.setIsFullscreen,
    minFreezeDuration: params.minFreezeDuration,
    lastFreezeTimestampRef,
    freezeTimeoutRef,
  });

  const seekSlide = useSlideClock(params.currentItem, playing, params.setCurrentTime, actions.handleItemEnd);

  useLayoutEffect(() => {
    timelineCallbacks.current = {
      onEnd: () => {
        if (!scrub.current && failedTime.current === null)
          actions.handleItemEnd();
      },
      onTime: (time) => {
        if (
          !reverseAbort.current &&
          !scrub.current &&
          failedTime.current === null
        )
          params.setCurrentTime(time);
        if (scrub.current || failedTime.current !== null) return;
        const annotation = params.currentAnnotation;
        if (!annotation || params.isFrozen || !params.isPlaying) return;
        const recent = lastFreezeTimestampRef.current;
        if (
          recent !== null &&
          Math.abs(time - recent) < params.freezeRetriggerGuard
        )
          return;
        if (
          annotation.objects.some(
            (object) =>
              !object.motion &&
              Math.abs(time - object.timestamp) <
                params.annotationTimeTolerance,
          )
        ) {
          lastFreezeTimestampRef.current = time;
          actions.triggerFreezeFrame(
            Math.max(
              params.minFreezeDuration,
              annotation.freezeDuration || params.defaultFreezeDuration,
            ),
          );
        }
      },
    };
  }, [actions.handleItemEnd, actions.triggerFreezeFrame, params]);

  const setConfirmedCurrentTime = useCallback<
    UsePlaylistPlaybackParams['setCurrentTime']
  >(
    (value) => {
      if (
        !reverseAbort.current &&
        !scrub.current &&
        failedTime.current === null
      )
        params.setCurrentTime(value);
    },
    [params.setCurrentTime],
  );

  usePlaylistPlaybackEffects({
    disabled: mediaTimeline.active,
    isFrozen: params.isFrozen,
    setIsFrozen: params.setIsFrozen,
    currentItem: params.currentItem,
    currentAnnotation: params.currentAnnotation,
    minFreezeDuration: params.minFreezeDuration,
    defaultFreezeDuration: params.defaultFreezeDuration,
    annotationTimeTolerance: params.annotationTimeTolerance,
    freezeRetriggerGuard: params.freezeRetriggerGuard,
    videoRef: params.videoRef,
    videoRef2: params.videoRef2,
    setCurrentTime: setConfirmedCurrentTime,
    setDuration: params.setDuration,
    isPlaying: playing,
    currentVideoSource: params.currentVideoSource,
    currentVideoSource2: params.currentVideoSource2,
    viewMode: params.viewMode,
    volume: params.volume,
    isMuted: params.isMuted,
    lastFreezeTimestampRef,
    triggerFreezeFrame: actions.triggerFreezeFrame,
    handleItemEnd: actions.handleItemEnd,
  });

  const cancelReverseSeek = (): void => {
    reverseAbort.current?.abort();
    reverseAbort.current = null;
    reverseAbortOwner.current = null;
    mediaTimeline.confirmSeek();
  };
  useEffect(
    () => () => {
      if (currentOwner.current === seekOwner) currentOwner.current = null;
      if (reverseAbortOwner.current === seekOwner)
        reverseAbort.current?.abort();
    },
    [seekOwner],
  );
  const present = async (
    time: number,
    signal: AbortSignal,
    exact: boolean,
  ): Promise<number | null> => {
    if (mediaTimeline.loading || mediaTimeline.error)
      throw Error('PLAYLIST_MEDIA_UNAVAILABLE');
    const targets: VideoPresentationTarget[] = [];
    [params.videoRef, params.videoRef2].forEach((ref, index) => {
      if (
        (index === 0 && params.viewMode === 'angle2') ||
        (index === 1 && params.viewMode === 'angle1')
      )
        return;
      const source =
        index === 0 ? params.currentVideoSource : params.currentVideoSource2;
      if (!source) return;
      if (!ref.current) {
        if (exact) throw Error('PLAYLIST_VIDEO_UNAVAILABLE');
        return;
      }
      const resolved = mediaTimeline.resolve(time, index === 1, exact);
      if (resolved === null) return;
      targets.push({
        video: ref.current,
        source: formatSource(resolved?.clip.source ?? source),
        time: resolved?.sourceTime ?? time,
        offset: resolved?.sourceTimeOffset ?? 0,
      });
    });
    return waitForVideoPresentation(
      targets,
      signal,
      () => {
        if (!mediaTimeline.seek(time, false))
          targets.forEach(({ video, time }) => {
            video.pause();
            video.currentTime = time;
          });
      },
      exact,
    );
  };
  const cancelScrub = (): void => {
    scrub.current?.cancel();
    scrub.current = null;
    failedTime.current = null;
    setScrubbing(false);
    setScrubError('');
  };
  useLayoutEffect(() => {
    currentOwner.current = seekOwner;
    failedTime.current = null;
    setScrubbing(false);
    setScrubError('');
    return () => {
      scrub.current?.cancel();
      scrub.current = null;
    };
  }, [seekOwner]);
  const handleScrub = (time: number, final: boolean): void => {
    if (params.currentItem?.slide) { seekSlide(time); setScrubbing(!final); return; }
    const item = params.currentItem;
    if (
      !item ||
      !Number.isFinite(time) ||
      currentOwner.current !== seekOwner ||
      (final && !scrub.current)
    )
      return;
    requested.current = Math.min(item.endTime, Math.max(item.startTime, time));
    if (!scrub.current) {
      cancelReverseSeek();
      failedTime.current = null;
      setScrubError('');
      setScrubbing(true);
      lastFreezeTimestampRef.current = null;
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
      params.setIsFrozen(false);
      scrub.current = new TimelineScrub(
        'playlist',
        (value, signal) => present(value, signal, true),
        (confirmed) => {
          mediaTimeline.confirmSeek(confirmed);
          params.setCurrentTime(confirmed);
        },
        (failed) => {
          scrub.current = null;
          mediaTimeline.confirmSeek();
          if (failed) {
            failedTime.current = requested.current;
            params.setIsPlaying(false);
            setScrubError(
              '指定した位置の映像を確認できませんでした。再度シークしてください。',
            );
          }
          setScrubbing(false);
        },
      );
    }
    scrub.current.request(requested.current, final);
  };
  const seekReverse = async (
    time: number,
    signal: AbortSignal,
  ): Promise<number | null> => {
    if (signal.aborted || currentOwner.current !== seekOwner)
      throw Error('REVERSE_CANCELLED');
    if (scrub.current || failedTime.current !== null) cancelScrub();
    const abort = new AbortController();
    reverseAbort.current?.abort();
    reverseAbort.current = abort;
    reverseAbortOwner.current = seekOwner;
    const cancel = (): void => abort.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) abort.abort();
    try {
      const measured = await present(time, abort.signal, false);
      if (abort.signal.aborted || currentOwner.current !== seekOwner)
        throw Error('REVERSE_CANCELLED');
      mediaTimeline.confirmSeek(measured ?? time);
      params.setCurrentTime(measured ?? time);
      return measured;
    } catch (cause) {
      if (reverseAbort.current === abort) mediaTimeline.confirmSeek();
      throw cause;
    } finally {
      signal.removeEventListener('abort', cancel);
      if (reverseAbort.current === abort) {
        reverseAbort.current = null;
        reverseAbortOwner.current = null;
      }
    }
  };
  return {
    mediaTimeline: {
      ...mediaTimeline,
      error: mediaTimeline.error || scrubError,
      retry: () => {
        if (failedTime.current !== null && !mediaTimeline.error) {
          const time = failedTime.current;
          handleScrub(time, false);
          handleScrub(time, true);
        } else mediaTimeline.retry();
      },
    },
    handleScrub,
    scrubbing,
    seekReverse,
    cancelReverseSeek,
    handlePlayItem: actions.handlePlayItem,
    handlePlayRow: actions.handlePlayRow,
    handleTogglePlay: actions.handleTogglePlay,
    handlePrevious: actions.handlePrevious,
    handleNext: actions.handleNext,
    handleSeek: (event: Event, value: number | number[]): void => {
      cancelReverseSeek();
      cancelScrub();
      if (params.currentItem?.slide) seekSlide(Array.isArray(value) ? value[0] : value);
      else actions.handleSeek(event, value);
    },
    handleVolumeChange: actions.handleVolumeChange,
    handleToggleFullscreen: actions.handleToggleFullscreen,
    triggerFreezeFrame: actions.triggerFreezeFrame,
  };
};
