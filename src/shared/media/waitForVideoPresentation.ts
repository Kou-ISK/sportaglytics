export interface VideoPresentationTarget {
  video: HTMLVideoElement;
  source: string;
  time: number;
  offset: number;
}
const displayed = new WeakMap<
  HTMLVideoElement,
  { source: string; pts: number }
>();

/** The next seek cannot start until the compositor callback and a paint fence.
 * The PTS is retained separately from currentTime (which changes on assignment). */
export const waitForVideoPresentation = (
  targets: readonly VideoPresentationTarget[],
  signal: AbortSignal,
  seek: () => void,
): Promise<number | null> =>
  new Promise((resolve, reject) => {
    const callbacks = new Map<HTMLVideoElement, number>();
    const confirmed = new Map<HTMLVideoElement, number>();
    let frame = 0;
    let done = false;
    let fenced = false;
    const cleanup = (): void => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      for (const [video, id] of callbacks) video.cancelVideoFrameCallback(id);
      signal.removeEventListener('abort', aborted);
    };
    const finish = (error?: Error): void => {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else
        resolve(
          targets.length ? (confirmed.get(targets[0].video) ?? null) : null,
        );
    };
    const aborted = (): void => finish(new Error('REVERSE_CANCELLED'));
    const timeout = setTimeout(
      () => finish(new Error('REVERSE_IMAGE_TIMEOUT')),
      5000,
    );
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) {
      aborted();
      return;
    }
    const register = (target: VideoPresentationTarget): void => {
      const { video, source } = target;
      if (typeof video.requestVideoFrameCallback !== 'function') {
        finish(new Error('REVERSE_FRAME_CALLBACK_UNAVAILABLE'));
        return;
      }
      callbacks.set(
        video,
        video.requestVideoFrameCallback((_now, metadata) => {
          if (done || signal.aborted) return;
          if (video.currentSrc === source)
            displayed.set(video, { source, pts: metadata.mediaTime });
          register(target);
        }),
      );
    };
    for (const target of targets) register(target);
    if (done) return;
    try {
      seek();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    const check = (): void => {
      if (signal.aborted) {
        aborted();
        return;
      }
      for (const target of targets) {
        const { video, source, time, offset } = target;
        if (video.error) {
          finish(new Error('REVERSE_MEDIA_ERROR'));
          return;
        }
        confirmed.delete(video);
        const image = displayed.get(video);
        if (
          video.currentSrc === source &&
          !video.seeking &&
          video.readyState >= 2 &&
          Math.abs(video.currentTime - time) < 0.02 &&
          image?.source === source &&
          // A cached image later than the reverse target is not its display.
          // Reusing it would complete another seek before any reverse image.
          image.pts <= time + 0.000001 &&
          time - image.pts <= 0.05
        ) {
          confirmed.set(video, video.currentTime - offset);
        }
      }
      if (confirmed.size === targets.length) {
        // rVFC runs before paint. Retain the current request through this paint.
        if (fenced) finish();
        else {
          fenced = true;
          frame = requestAnimationFrame(check);
        }
      } else {
        fenced = false;
        frame = requestAnimationFrame(check);
      }
    };
    frame = requestAnimationFrame(check);
  });
