import type { PackageMediaAngle } from '../../../../types/package/metadata';
import type { VideoSyncData } from '../../../../types/video/sync';
import { getAngleOffset } from '../../../../shared/media/mediaTimeline';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatSource } from '../../../../shared/media/videoSource';
import { getVideoJsPlayer } from '../../shared/videojs/videoJsAdapter';
import {
  getNativePlayback,
  subscribeNativePlayback,
} from '../../shared/nativePlayback/nativePlaybackRegistry';
import {
  findScrubFrame,
  ScrubPreviewLayer,
} from '../../shared/scrubPreview/scrubPreviewLayer';
import type { RefObject } from 'react';

interface Lease {
  token: string;
  anchor: number;
  video: HTMLVideoElement;
  layer: ScrubPreviewLayer | null;
  close: () => void;
}
export const useScrubPreview = (
  videoList: readonly string[],
  angles: readonly PackageMediaAngle[],
  sync: VideoSyncData | undefined,
  mode: string,
  time: number,
  busy: boolean,
): RefObject<ScrubPreviewLayer | null> => {
  const angle = angles.length === 1 ? angles[0] : null;
  const clip = angle?.clips.length === 1 ? angle.clips[0] : null;
  const source =
    mode === 'auto' &&
    videoList.length === 1 &&
    angle?.playbackFormat !== 'fragmented-mp4' &&
    clip?.sourceKind === 'local' &&
    clip.timelineStartSeconds === 0 &&
    clip.gapBeforeSeconds === 0 &&
    getAngleOffset(sync, 0) === 0
      ? clip.source
      : null;
  const layer = useRef<ScrubPreviewLayer | null>(null),
    lease = useRef<Lease | null>(null);
  const attempted = useRef<number | null>(null);
  useLayoutEffect(() => {
    attempted.current = null;
    const close = (): void => lease.current?.close();
    const unsub = subscribeNativePlayback(() => {
      if (getNativePlayback()) close();
    });
    return () => {
      unsub();
      close();
    };
  }, [source]);
  useEffect(() => {
    const api = window.electronAPI?.scrubPreview;
    if (!api || !source || !Number.isFinite(time)) return;
    const previous = lease.current;
    if (busy) {
      if (previous && !previous.layer) {
        attempted.current = null;
        previous.close();
      }
      return;
    }
    if (previous?.layer && findScrubFrame(previous.layer.strip, time)) return;
    if (previous && !previous.layer && Math.abs(previous.anchor - time) < 3)
      return;
    if (attempted.current !== null && Math.abs(time - attempted.current) < 3)
      return;
    // Opening, continuous play and moving the slider never wait for preparation.
    const prepare = (): void => {
      if (getNativePlayback() || document.hidden) return;
      const video = getVideoJsPlayer('video_0')?.el?.()?.querySelector('video');
      if (
        !(video instanceof HTMLVideoElement) ||
        !video.paused ||
        video.seeking ||
        video.readyState < 2 ||
        video.videoWidth < 1920 ||
        video.videoHeight < 1080 ||
        video.currentSrc !== formatSource(source)
      )
        return;
      previous?.close();
      attempted.current = time;
      const token = crypto.randomUUID();
      const close = (): void => {
        if (lease.current?.token !== token) return;
        video.removeEventListener('play', stopPreparation);
        video.removeEventListener('emptied', close);
        video.removeEventListener('loadstart', close);
        layer.current?.end();
        layer.current = null;
        lease.current = null;
        void api.release(token).catch(() => undefined);
      };
      const entry: Lease = { token, anchor: time, video, layer: null, close };
      const stopPreparation = (): void => {
        if (lease.current === entry && !entry.layer) {
          attempted.current = null;
          close();
        }
      };
      lease.current = entry;
      video.addEventListener('play', stopPreparation, { once: true });
      video.addEventListener('emptied', close);
      video.addEventListener('loadstart', close);
      void api
        .prepare({ token, time })
        .then((strip) => {
          if (lease.current !== entry) return;
          if (
            !strip ||
            !video.isConnected ||
            strip.sourceUrl !== video.currentSrc ||
            getNativePlayback()
          ) {
            close();
            return;
          }
          entry.layer = new ScrubPreviewLayer(strip, video, async () => {
            const valid = await api.validate(token).catch(() => false);
            if (!valid) close();
            return valid;
          });
          layer.current = entry.layer;
        })
        .catch(close);
    };
    let timer = setTimeout(prepare, 1800);
    const arm = (): void => {
      clearTimeout(timer);
      if (
        !document.hidden &&
        !lease.current &&
        (attempted.current === null || Math.abs(time - attempted.current) >= 3)
      )
        timer = setTimeout(prepare, 1800);
    };
    const interrupt = (): void => {
      clearTimeout(timer);
      const current = lease.current;
      if (current && !current.layer) {
        attempted.current = null;
        current.close();
      }
    };
    const visibility = (): void => {
      if (document.hidden) interrupt();
      else arm();
    };
    document.addEventListener('pointerdown', interrupt, true);
    document.addEventListener('keydown', interrupt, true);
    document.addEventListener('pointerup', arm, true);
    document.addEventListener('keyup', arm, true);
    document.addEventListener('loadeddata', arm, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('loadeddata', arm, true);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', interrupt, true);
      document.removeEventListener('keydown', interrupt, true);
      document.removeEventListener('pointerup', arm, true);
      document.removeEventListener('keyup', arm, true);
    };
  }, [source, time, busy]);
  return layer;
};
