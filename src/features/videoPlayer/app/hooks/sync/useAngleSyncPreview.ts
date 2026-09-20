import { useEffect, useRef } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import { resolveAngleSyncTime } from './angleSync';
import { useClipSyncPreview } from './useClipSyncPreview';
import { useAngleSyncPreviewClock } from './useAngleSyncPreviewClock';

export interface AnglePreviewStatus {
  clipId: string;
  ready: boolean;
}

/** A whole angle has one clock; source files change transparently at segment boundaries. */
export const useAngleSyncPreview = (props: {
  index: number;
  angle: PackageMediaAngle;
  offset: number;
  time: number;
  playing: boolean;
  suspended: boolean;
  onDuration: (index: number, clipId: string, duration: number) => void;
  onStatus: (index: number, status: AnglePreviewStatus) => void;
  onAspect: (index: number, ratio: number) => void;
}): ReturnType<typeof useClipSyncPreview> & { gap: boolean } => {
  const resolved = resolveAngleSyncTime(props.angle, props.offset, props.time);
  // Keep a source loaded during a gap so seek/metadata stay available; never display its stale frame.
  const clip = resolved?.clip ?? props.angle.clips[0];
  const media = useClipSyncPreview(
    `sync_angle_${props.index}`,
    clip?.source ?? '',
    (duration) => {
      if (clip) props.onDuration(props.index, clip.id, duration);
    },
  );
  const current = useRef({ props, resolved, media });
  current.current = { props, resolved, media };
  useAngleSyncPreviewClock({
    playerRef: media.playerRef,
    source: media.source,
    time: resolved?.sourceTime ?? null,
    ready: media.isReady,
    playing: props.playing,
    suspended: props.suspended,
    error: media.error,
    play: media.play,
  });
  useEffect(() => {
    const player = media.playerRef.current;
    if (!player || !clip) return;
    const update = (): void => {
      const state = current.current;
      const ready =
        !player.isDisposed() &&
        state.media.isReady &&
        !state.media.error &&
        (props.angle.sourceKind === 'youtube' ||
          ((player.readyState() ?? 0) >= 2 && !player.seeking()));
      state.props.onStatus(state.props.index, { clipId: clip.id, ready });
      const video = state.media.containerRef.current?.querySelector('video');
      if (video?.videoWidth && video.videoHeight)
        state.props.onAspect(
          state.props.index,
          video.videoWidth / video.videoHeight,
        );
    };
    update();
    const events = [
      'loadeddata',
      'canplay',
      'waiting',
      'seeking',
      'error',
      'seeked',
    ];
    events.forEach((name) => player.on(name, update));
    return () => {
      if (!player.isDisposed())
        events.forEach((name) => player.off(name, update));
    };
  }, [clip?.id, media.isReady, media.error, media.playerRef]);
  return { ...media, gap: !resolved };
};
