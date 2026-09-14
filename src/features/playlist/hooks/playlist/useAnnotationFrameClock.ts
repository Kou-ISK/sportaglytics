import { useEffect } from 'react';
import type { RefObject } from 'react';
/** Storybook playback controls share the presented video's timestamp. Canvas drawing has its own synchronous frame callback. */
export const useAnnotationFrameClock = (
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onTime: (time: number) => void,
): void => {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;
    let id = 0;
    let cancelled = false;
    const update: VideoFrameRequestCallback = (_now, frame) => {
      if (cancelled) return;
      onTime(frame.mediaTime);
      id = video.requestVideoFrameCallback(update);
    };
    id = video.requestVideoFrameCallback(update);
    return () => {
      cancelled = true;
      video.cancelVideoFrameCallback(id);
    };
  }, [videoRef, enabled, onTime]);
};
