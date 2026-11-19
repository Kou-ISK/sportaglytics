export interface VideoPresentationTarget {
  video: HTMLVideoElement;
  source: string;
  time: number;
  offset: number;
}
const pendingAssignments = new WeakMap<
  HTMLVideoElement,
  (previous: number | null) => void
>();

/** Clip-aware Video.js players issue their DOM seek after React commits. */
export const issueVideoPresentationSeek = (
  video: HTMLVideoElement | null,
  issue: () => void,
): void => {
  const observer = video && pendingAssignments.get(video);
  const previous = observer && !video.seeking ? video.currentTime : null;
  issue();
  observer?.(previous);
};
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
  exactScrub = false,
): Promise<number | null> =>
  new Promise((resolve, reject) => {
    const callbacks = new Map<HTMLVideoElement, number>();
    const epochs = new Map<HTMLVideoElement, number>();
    const expectedSourceChanges = new Set<HTMLVideoElement>();
    const seekStarted = new Set<HTMLVideoElement>();
    const submittedAfter = new Map<HTMLVideoElement, number>();
    const requestBeganAt = performance.now();
    const distant = new Set<HTMLVideoElement>();
    const assignments = new Map<
      HTMLVideoElement,
      (previous: number | null) => void
    >();
    const earlyImage = new Set<HTMLVideoElement>();
    const origin = new Map(
      targets.map(({ video, source }) => [
        video,
        !video.seeking && video.currentSrc === source
          ? video.currentTime
          : null,
      ]),
    );
    const seekListeners = new Map<HTMLVideoElement, () => void>();
    const sourceListeners = new Map<HTMLVideoElement, () => void>();
    // Only the same previously verified stopped seek can reuse an image.
    // After a small forward move the previous PTS could still be within 50 ms.
    const baseline = new Map(
      targets.map(({ video }) => [video, displayed.get(video)]),
    );
    const sameSeek = (target: VideoPresentationTarget): boolean => {
      const { video, source, time } = target;
      const proof = settledFrames.get(video);
      return (
        !!proof &&
        video.paused &&
        !video.seeking &&
        video.currentSrc === source &&
        proof.source === source &&
        Math.abs(proof.seekTime - time) <= 0.000001 &&
        Math.abs(video.currentTime - proof.seekTime) <= 0.000001
      );
    };
    const confirmed = new Map<HTMLVideoElement, number>();
    let frame = 0;
    let done = false;
    let fenced = false;
    const cleanup = (): void => {
      for (const [video, observer] of assignments)
        if (pendingAssignments.get(video) === observer)
          pendingAssignments.delete(video);
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      for (const [video, id] of callbacks) video.cancelVideoFrameCallback(id);
      for (const [video, listener] of seekListeners)
        video.removeEventListener('seeking', listener);
      for (const [video, listener] of sourceListeners) {
        video.removeEventListener('loadedmetadata', listener);
        video.removeEventListener('loadeddata', listener);
      }
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
          if (done || signal.aborted || registeredEpoch !== epochs.get(video))
            return;
          if ((mediaEpochs.get(video) ?? 0) !== epochs.get(video)) {
            if (!expectedSourceChanges.has(video))
              finish(new Error('REVERSE_MEDIA_CHANGED'));
            return;
          }
          const submitted = submittedAfter.get(video);
          // Chromium can present the destination image before delivering its
          // queued DOM seeking event. Only a synchronous distant seek can use
          // this ordering: an adjacent or already queued old image is ambiguous.
          const early =
            distant.has(video) &&
            submitted !== undefined &&
            !seekStarted.has(video) &&
            metadata.presentationTime > submitted &&
            metadata.mediaTime <= target.time + 0.000001 &&
            target.time - metadata.mediaTime <= 0.05;
          if (
            (!exactScrub ||
              ((seekStarted.has(video) || early) &&
                metadata.presentationTime > (submitted ?? requestBeganAt) &&
                video.paused &&
                Math.abs(video.currentTime - target.time) <= 0.000001)) &&
            !expectedSourceChanges.has(video) &&
            video.currentSrc === source
          ) {
            displayed.set(video, { source, pts: metadata.mediaTime });
            if (early) earlyImage.add(video);
          }
          if (earlyImage.has(video) && !early && !seekStarted.has(video)) {
            earlyImage.delete(video);
            displayed.delete(video);
          }
          register(target);
        }),
      );
    };
    for (const target of targets) {
      if (done) break;
      watchFrameInvalidation(target.video);
      epochs.set(target.video, mediaEpochs.get(target.video) ?? 0);
      if (exactScrub) {
        const { video } = target;
        const submitted = (previous: number | null): void => {
          if (
            video.currentSrc !== target.source ||
            !video.seeking ||
            Math.abs(video.currentTime - target.time) > 0.000001
          )
            return;
          submittedAfter.set(video, performance.now());
          if (previous !== null && Math.abs(previous - target.time) > 0.1)
            distant.add(video);
          else distant.delete(video);
        };
        assignments.set(video, submitted);
        pendingAssignments.set(video, submitted);
        const started = (): void => {
          if (
            video.currentSrc !== target.source ||
            Math.abs(video.currentTime - target.time) > 0.000001
          ) {
            displayed.delete(video);
            earlyImage.delete(video);
            seekStarted.delete(video);
            return;
          }
          const prior = displayed.get(video);
          // A second seek to the identical frame need not submit another image.
          // Keep only an exact PTS observed during this operation and source.
          const repeatedExactImage =
            seekStarted.has(video) &&
            video.paused &&
            prior !== baseline.get(video) &&
            prior?.source === target.source &&
            Math.abs(prior.pts - target.time) <= 0.000001;
          seekStarted.add(video);
          if (!earlyImage.delete(video) && !repeatedExactImage)
            displayed.delete(video);
        };
        seekListeners.set(video, started);
        video.addEventListener('seeking', started);
        if (video.seeking) started();
      }
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
          if (
            exactScrub &&
            Math.abs(target.video.currentTime - target.time) <= 0.000001
          )
            seekStarted.add(target.video);

          epochs.set(target.video, mediaEpochs.get(target.video) ?? 0);
          displayed.delete(target.video);
          const id = callbacks.get(target.video);
          if (id !== undefined) target.video.cancelVideoFrameCallback(id);
          register(target);
          const { video, time } = target;
          // Video.js can defer its first seek on a new tech until canplay.
          // Bind the exact seek to this loaded source before its paused
          // decoder submits the only destination image.
          if (
            exactScrub &&
            video.paused &&
            !video.seeking &&
            video.readyState >= 1 &&
            Math.abs(video.currentTime - time) > 0.000001
          ) {
            try {
              issueVideoPresentationSeek(video, () => {
                video.currentTime = time;
              });
            } catch (error) {
              finish(error instanceof Error ? error : new Error(String(error)));
            }
          }
        };
        sourceListeners.set(target.video, loaded);
        // Chromium may present the first destination image before loadeddata.
        target.video.addEventListener('loadedmetadata', loaded);
        target.video.addEventListener('loadeddata', loaded);
      }
      register(target);
    }
    if (done) return;
    try {
      seek();
      if (exactScrub) {
        for (const target of targets) {
          const { video, source, time } = target;
          if (!submittedAfter.has(video))
            assignments.get(video)?.(origin.get(video) ?? null);
          if (
            video.currentSrc === source &&
            video.paused &&
            !video.seeking &&
            Math.abs(video.currentTime - time) <= 0.000001 &&
            !sameSeek(target)
          )
            video.currentTime = time;
        }
      }
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
          Math.abs(video.currentTime - time) <=
            (exactScrub ? 0.000001 : 0.02) &&
          image?.source === source &&
          (!exactScrub ||
            (video.paused &&
              (image !== baseline.get(video) || sameSeek(target)))) &&
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
