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
            // A failed native rate gesture restores a stopped image, not a seek loop.
            held.current = null;
            unwatch.current?.();
            unwatch.current = null;
            // Recovery publishes original only after async drain/restoration.
            // Commit this notification now, before any later HTML operation.
            const current = getNativePlayback();
            if (
              native.commandRevision !== owner.revision ||
              (current !== null && current !== native)
            )
              return;
            onNativeControls(false, 1);
            const after = getNativePlayback();
            if (
              native.commandRevision !== owner.revision ||
              (after !== null && after !== native)
            )
              return;
            if (state.error)
              params.onError?.(new Error('REVERSE_NATIVE_UNAVAILABLE'));
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
      params.onError,
      reverse.cancelReversePlayback,
      reverse.startReversePlayback,
    ],
  );
  const finish = useCallback((): void => {
    const owner = held.current;
    held.current = null;
    unwatch.current?.();
    unwatch.current = null;
    if (!owner) {
      reverse.stopReversePlayback();
      return;
    }
    stopWait.current?.abort();
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
    void waitForNativePresentation(owner.native, revision, abort.signal, () => {
      const current = getNativePlayback();
      const restored = owner.native.snapshot().phase === 'original';
      if (
        abort.signal.aborted ||
        stopWait.current !== abort ||
        (current !== owner.native && !(current === null && restored)) ||
        owner.native.commandRevision !== revision
      )
        return;
      // Commit at the confirmation boundary, before a later HTML action.
      stopWait.current = null;
      if (!restored) {
        owner.native.controls({ playing: false, rate: 1 });
        if (
          getNativePlayback() !== owner.native ||
          owner.native.commandRevision !== revision + 1 ||
          owner.native.requestedControls.playing !== false ||
          owner.native.requestedControls.rate !== 1
        )
          return;
      }
      onNativeControls?.(false, 1);
    }).catch(() => {});
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
