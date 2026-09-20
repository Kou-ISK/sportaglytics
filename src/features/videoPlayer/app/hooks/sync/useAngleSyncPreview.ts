import { useEffect, useRef } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import { resolveAngleSyncTime } from './angleSync';
import { useClipSyncPreview } from './useClipSyncPreview';

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
  useEffect(() => {
    if (!media.isReady || props.suspended) return;
    const player = media.playerRef.current;
    if (!player || player.isDisposed()) return;
    if (!resolved || media.error) {
      player.pause();
      return;
    }
    const time = player.currentTime() ?? 0;
    const local = resolved.sourceTime;
    if (Math.abs(time - local) > (props.playing ? 0.08 : 0.00005))
      player.currentTime(local);
    if (props.playing && player.paused()) media.play();
    else if (!props.playing && !player.paused()) player.pause();
  }, [
    props.time,
    props.playing,
    props.suspended,
    resolved?.clip.id,
    media.isReady,
    media.error,
    media.playerRef,
    resolved,
    media.play,
  ]);
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
          (player.readyState() ?? 0) >= 2);
      state.props.onStatus(state.props.index, { clipId: clip.id, ready });
      const video = state.media.containerRef.current?.querySelector('video');
      if (video?.videoWidth && video.videoHeight)
        state.props.onAspect(
          state.props.index,
          video.videoWidth / video.videoHeight,
        );
    };
    update();
    const events = ['loadeddata', 'canplay', 'waiting', 'error', 'seeked'];
    events.forEach((name) => player.on(name, update));
    return () => {
      if (!player.isDisposed())
        events.forEach((name) => player.off(name, update));
    };
  }, [clip?.id, media.isReady, media.error, media.playerRef]);
  return { ...media, gap: !resolved };
};
