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

const settledFrames = new WeakMap<
  HTMLVideoElement,
  { source: string; seekTime: number; pts: number }
>();
const watchedFrames = new WeakSet<HTMLVideoElement>();
const mediaEpochs = new WeakMap<HTMLVideoElement, number>();
const watchFrameInvalidation = (video: HTMLVideoElement): void => {
  if (watchedFrames.has(video)) return;
  watchedFrames.add(video);
  const invalidateProof = (): void => {
    settledFrames.delete(video);
  };
  const invalidate = (): void => {
    invalidateProof();
    displayed.delete(video);
  };
  const reload = (): void => {
    invalidate();
    mediaEpochs.set(video, (mediaEpochs.get(video) ?? 0) + 1);
  };
  video.addEventListener('seeking', invalidateProof);
  video.addEventListener('play', invalidate);
  for (const name of ['emptied', 'loadstart'])
    video.addEventListener(name, reload);
};
export const isConfirmedDisplayedFrame = (
  video: HTMLVideoElement,
  target: number,
): boolean => {
  const frame = settledFrames.get(video);
  return (
    !!frame &&
    video.paused &&
    !video.seeking &&
    video.currentSrc === frame.source &&
    Math.abs(video.currentTime - frame.seekTime) < 0.000001 &&
    Math.abs(target - frame.pts) < 0.000001
  );
};

/** The next seek cannot start until the compositor callback and a paint fence.
 * The PTS is retained separately from currentTime (which changes on assignment). */
export const waitForVideoPresentation = (
  targets: readonly VideoPresentationTarget[],
  signal: AbortSignal,
  seek: () => void,
): Promise<number | null> =>
  new Promise((resolve, reject) => {
    const callbacks = new Map<HTMLVideoElement, number>();
    const epochs = new Map<HTMLVideoElement, number>();
    const expectedSourceChanges = new Set<HTMLVideoElement>();
    const sourceListeners = new Map<HTMLVideoElement, () => void>();
    const confirmed = new Map<HTMLVideoElement, number>();
    let frame = 0;
    let done = false;
    let fenced = false;
    const cleanup = (): void => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      for (const [video, id] of callbacks) video.cancelVideoFrameCallback(id);
      for (const [video, listener] of sourceListeners)
        video.removeEventListener('loadeddata', listener);
      signal.removeEventListener('abort', aborted);
    };
    const finish = (error?: Error): void => {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else {
        for (const target of targets) {
          const image = displayed.get(target.video);
          if (image && image.source === target.source)
            settledFrames.set(target.video, {
              source: target.source,
              seekTime: target.video.currentTime,
              pts: image.pts,
            });
        }
        resolve(
          targets.length ? (confirmed.get(targets[0].video) ?? null) : null,
        );
      }
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
      if (done) return;
      const { video, source } = target;
      if (typeof video.requestVideoFrameCallback !== 'function') {
        finish(new Error('REVERSE_FRAME_CALLBACK_UNAVAILABLE'));
        return;
      }
      const registeredEpoch = epochs.get(video);
      callbacks.set(
        video,
        video.requestVideoFrameCallback((_now, metadata) => {
          if (done || signal.aborted || registeredEpoch !== epochs.get(video)) return;
          if ((mediaEpochs.get(video) ?? 0) !== epochs.get(video)) {
            if (!expectedSourceChanges.has(video))
              finish(new Error('REVERSE_MEDIA_CHANGED'));
            return;
          }
          if (!expectedSourceChanges.has(video) && video.currentSrc === source)
            displayed.set(video, { source, pts: metadata.mediaTime });
          register(target);
        }),
      );
    };
    for (const target of targets) {
      if (done) break;
      watchFrameInvalidation(target.video);
      epochs.set(target.video, mediaEpochs.get(target.video) ?? 0);
      if (target.video.currentSrc !== target.source) {
        expectedSourceChanges.add(target.video);
        const loaded = (): void => {
          if (
            done ||
            signal.aborted ||
            !expectedSourceChanges.has(target.video) ||
            target.video.currentSrc !== target.source ||
            (mediaEpochs.get(target.video) ?? 0) === epochs.get(target.video)
          )
            return;
          expectedSourceChanges.delete(target.video);
          epochs.set(target.video, mediaEpochs.get(target.video) ?? 0);
          displayed.delete(target.video);
          const id = callbacks.get(target.video);
          if (id !== undefined) target.video.cancelVideoFrameCallback(id);
          register(target);
        };
        sourceListeners.set(target.video, loaded);
        target.video.addEventListener('loadeddata', loaded);
      }
      register(target);
    }
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
        if (expectedSourceChanges.has(video)) {
          confirmed.delete(video);
          continue;
        }
        if ((mediaEpochs.get(video) ?? 0) !== epochs.get(video)) {
          finish(new Error('REVERSE_MEDIA_CHANGED'));
          return;
        }
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
          confirmed.set(video, image.pts - offset);
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
