import { useCallback, useEffect, useRef } from 'react';
import { useContinuousReversePlayback } from '../../../../hooks/useContinuousReversePlayback';
import type { ReversePlaybackRate } from '../../../../hooks/useContinuousReversePlayback';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import type { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import { waitForNativePresentation } from '../../shared/nativePlayback/waitForNativePresentation';

type Params = Parameters<typeof useContinuousReversePlayback>[0] & {
  videoList: readonly string[];
  onNativeControls?: (playing: boolean, rate: number) => void;
};
type Controller = ReturnType<typeof useContinuousReversePlayback> & {
  finishReversePlayback: () => void;
};
export const useVideoReversePlayback = ({
  videoList,
  onNativeControls,
  ...params
}: Params): Controller => {
  const held = useRef<{
    native: NativePlaybackController;
    revision: number;
    seekRevision: number;
    rate: number;
  } | null>(null);
  const stopWait = useRef<AbortController | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const issuing = useRef(false);
  const reverse = useContinuousReversePlayback({
    ...params,
    onSeek: async (time, signal) => {
      const native = getNativePlayback();
      issuing.current = true;
      try {
        if (
          native &&
          (native.snapshot().phase === 'active' || native.isFallingBack)
        ) {
          native.seek(time);
          const revision = native.commandRevision;
          issuing.current = false;
          await waitForNativePresentation(native, revision, signal);
        } else {
          const work = params.onSeek(time, signal);
          issuing.current = false;
          await work;
        }
      } finally {
        issuing.current = false;
      }
    },
  });
  const cancel = useCallback((): void => {
    stopWait.current?.abort();
    stopWait.current = null;
    unwatch.current?.();
    unwatch.current = null;
    const owner = held.current;
    held.current = null;
    if (
      owner &&
      getNativePlayback() === owner.native &&
      owner.native.commandRevision === owner.revision
    ) {
      owner.native.controls({ playing: false, rate: 1 });
      onNativeControls?.(false, 1);
    }
    reverse.cancelReversePlayback();
  }, [onNativeControls, reverse.cancelReversePlayback]);
  const start = useCallback(
    (rate: ReversePlaybackRate): void => {
      const native = getNativePlayback();
      stopWait.current?.abort();
      unwatch.current?.();
      unwatch.current = null;
      if (native?.supportsReverse(rate) && onNativeControls) {
        reverse.cancelReversePlayback();
        native.controls({ playing: true, rate: -rate });
        const owner = {
          native,
          revision: native.commandRevision,
          seekRevision: native.seekRevision,
          rate,
        };
        held.current = owner;
        onNativeControls(true, -rate);
        unwatch.current = native.subscribe(() => {
          if (held.current !== owner) return;
          const state = native.snapshot();
          if (
            native.commandRevision !== owner.revision &&
            native.seekRevision === owner.seekRevision &&
            native.requestedControls.playing &&
            native.requestedControls.rate === -rate
          )
            owner.revision = native.commandRevision; // Audio settings retain the held transport.
          if (native.commandRevision !== owner.revision) {
            held.current = null;
            unwatch.current?.();
            unwatch.current = null;
          } else if (state.phase === 'original') {
            // Verified original restoration owns the clock before HTML resumes.
            held.current = null;
            unwatch.current?.();
            unwatch.current = null;
            const abort = new AbortController();
            stopWait.current = abort;
            queueMicrotask(() => {
              if (abort.signal.aborted || stopWait.current !== abort) return;
              stopWait.current = null;
              reverse.startReversePlayback(rate, state.time);
            });
          } else if (
            state.observation?.phase === 'paused' &&
            state.time === 0
          ) {
            held.current = null;
            unwatch.current?.();
            unwatch.current = null;
            native.controls({ playing: false, rate: 1 });
            onNativeControls(false, 1);
          }
        });
      } else {
        if (held.current) cancel();
        native?.controls({ playing: false, rate: 1 });
        reverse.startReversePlayback(rate);
      }
    },
    [
      cancel,
      onNativeControls,
      reverse.cancelReversePlayback,
      reverse.startReversePlayback,
    ],
  );
  const finish = useCallback((): void => {
    const owner = held.current;
    held.current = null;
    unwatch.current?.();
    unwatch.current = null;
    stopWait.current?.abort();
    if (!owner) {
      reverse.stopReversePlayback();
      return;
    }
    if (
      getNativePlayback() !== owner.native ||
      owner.native.commandRevision !== owner.revision
    )
      return;
    if (owner.native.snapshot().phase !== 'active') {
      owner.native.controls({ playing: false, rate: 1 });
      onNativeControls?.(false, 1);
      return;
    }
    // No release seek: the stopped AVPlayer clock and its image are authoritative.
    owner.native.controls({ playing: false, rate: -owner.rate });
    onNativeControls?.(false, -owner.rate);
    const abort = new AbortController();
    stopWait.current = abort;
    const revision = owner.native.commandRevision;
    void waitForNativePresentation(owner.native, revision, abort.signal).then(
      () => {
        if (
          abort.signal.aborted ||
          stopWait.current !== abort ||
          getNativePlayback() !== owner.native
        )
          return;
        owner.native.controls({ playing: false, rate: 1 });
        onNativeControls?.(false, 1);
        stopWait.current = null;
      },
      () => {},
    );
  }, [onNativeControls, reverse.stopReversePlayback]);
  useEffect(() => {
    const interrupted = (): void => {
      if (!issuing.current) cancel();
    };
    window.addEventListener('video-seek-start', interrupted);
    return () => window.removeEventListener('video-seek-start', interrupted);
  }, [cancel]);
  useEffect(() => cancel, [cancel, videoList]);
  return {
    isReverseSettled: reverse.isReverseSettled,
    startReversePlayback: start,
    stopReversePlayback: cancel,
    cancelReversePlayback: cancel,
    finishReversePlayback: finish,
  };
};
