import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Draw in the video callback itself so React's playback clock cannot move an overlay ahead of the displayed frame. */
export const useVideoFrameDrawing = (
  videoRef: RefObject<HTMLVideoElement | null> | undefined,
  enabled: boolean,
  draw: (mediaTime?: number) => void,
): void => {
  const latestDraw = useRef(draw);
  const presented = useRef<{
    video: HTMLVideoElement;
    source: string;
    time: number;
  } | null>(null);
  useLayoutEffect(() => {
    latestDraw.current = draw;
    const video = videoRef?.current;
    const frame = presented.current;
    draw(
      enabled &&
        video &&
        !video.paused &&
        frame?.video === video &&
        frame.source === video.currentSrc
        ? frame.time
        : undefined,
    );
  }, [draw, enabled, videoRef]);
  useEffect(() => {
    const video = videoRef?.current;
    if (
      !enabled ||
      !video ||
      typeof video.requestVideoFrameCallback !== 'function'
    )
      return;
    let cancelled = false;
    let id = 0;
    const update: VideoFrameRequestCallback = (_now, frame) => {
      if (cancelled) return;
      presented.current = {
        video,
        source: video.currentSrc,
        time: frame.mediaTime,
      };
      latestDraw.current(frame.mediaTime);
      id = video.requestVideoFrameCallback(update);
    };
    id = video.requestVideoFrameCallback(update);
    return () => {
      cancelled = true;
      video.cancelVideoFrameCallback(id);
      presented.current = null;
    };
  }, [enabled, videoRef]);
};
