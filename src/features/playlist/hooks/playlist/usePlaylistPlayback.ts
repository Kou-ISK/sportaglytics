import { waitForVideoPresentation } from '../../../../shared/media/waitForVideoPresentation';
import type { VideoPresentationTarget } from '../../../../shared/media/waitForVideoPresentation';
import { formatSource } from '../../../../shared/media/videoSource';
import { usePlaylistMediaTimeline } from '../../media/usePlaylistMediaTimeline';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { usePlaylistPlaybackActions } from './usePlaylistPlaybackActions';
import { usePlaylistPlaybackEffects } from './usePlaylistPlaybackEffects';
import type { UsePlaylistPlaybackParams } from './usePlaylistPlayback.types';

export const usePlaylistPlayback = (params: UsePlaylistPlaybackParams) => {
  const reverseAbort = useRef<AbortController | null>(null);
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
  const mediaTimeline = usePlaylistMediaTimeline(params, timelineCallbacks);
  const actions = usePlaylistPlaybackActions({
    seekMedia: mediaTimeline.seek,
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

  useLayoutEffect(() => {
    timelineCallbacks.current = {
      onEnd: actions.handleItemEnd,
      onTime: (time) => {
        if (!reverseAbort.current) params.setCurrentTime(time);
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

  const setConfirmedCurrentTime = useCallback<UsePlaylistPlaybackParams['setCurrentTime']>(
    (value) => {
      if (!reverseAbort.current) params.setCurrentTime(value);
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
    isPlaying: params.isPlaying,
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
    mediaTimeline.confirmSeek();
  };
  useEffect(
    () => () => {
      reverseAbort.current?.abort();
    },
    [
      params.currentItem?.id,
      params.currentVideoSource,
      params.currentVideoSource2,
      params.viewMode,
    ],
  );
  const seekReverse = async (
    time: number,
    signal: AbortSignal,
  ): Promise<void> => {
    const abort = new AbortController();
    reverseAbort.current?.abort();
    reverseAbort.current = abort;
    const cancel = (): void => abort.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) abort.abort();
    const targets: VideoPresentationTarget[] = [];
    [params.videoRef, params.videoRef2].forEach((ref, index) => {
      if (
        (index === 0 && params.viewMode === 'angle2') ||
        (index === 1 && params.viewMode === 'angle1')
      )
        return;
      const source =
        index === 0 ? params.currentVideoSource : params.currentVideoSource2;
      if (!source || !ref.current) return;
      const resolved = mediaTimeline.resolve(time, index === 1);
      if (resolved === null) return;
      targets.push({
        video: ref.current,
        source: formatSource(resolved?.clip.source ?? source),
        time: resolved?.sourceTime ?? time,
        offset: resolved?.sourceTimeOffset ?? 0,
      });
    });
    try {
      const measured = await waitForVideoPresentation(
        targets,
        abort.signal,
        () => {
          if (!mediaTimeline.seek(time, false))
            targets.forEach(({ video, time }) => {
              video.pause();
              video.currentTime = time;
            });
        },
      );
      if (abort.signal.aborted) throw Error('REVERSE_CANCELLED');
      params.setCurrentTime(measured ?? time);
    } finally {
      signal.removeEventListener('abort', cancel);
      if (reverseAbort.current === abort) {
        reverseAbort.current = null;
        mediaTimeline.confirmSeek();
      }
    }
  };
  return {
    mediaTimeline,
    seekReverse,
    cancelReverseSeek,
    handlePlayItem: actions.handlePlayItem,
    handleTogglePlay: actions.handleTogglePlay,
    handlePrevious: actions.handlePrevious,
    handleNext: actions.handleNext,
    handleSeek: (event: Event, value: number | number[]): void => {
      cancelReverseSeek();
      actions.handleSeek(event, value);
    },
    handleVolumeChange: actions.handleVolumeChange,
    handleToggleFullscreen: actions.handleToggleFullscreen,
    triggerFreezeFrame: actions.triggerFreezeFrame,
  };
};
