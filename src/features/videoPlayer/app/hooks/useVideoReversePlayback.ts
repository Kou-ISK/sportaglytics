import { useCallback, useEffect, useRef } from 'react';
import { useContinuousReversePlayback } from '../../../../hooks/useContinuousReversePlayback';
import type { ReversePlaybackRate } from '../../../../hooks/useContinuousReversePlayback';
import { getNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { nativePresentedTime } from '../../shared/nativePlayback/nativePresentedFrame';
import type { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';

type Params = Parameters<typeof useContinuousReversePlayback>[0] & {
  videoList: readonly string[];
};
type Controller = ReturnType<typeof useContinuousReversePlayback> & {
  finishReversePlayback: () => void;
};
/** Preserve the held input path; only release commits the visible stopped frame. */
export const useVideoReversePlayback = ({
  videoList,
  ...params
}: Params): Controller => {
  const held = useRef<{
    native: NativePlaybackController;
    revision: number;
    sought: boolean;
    atBoundary: boolean;
  } | null>(null);
  const reverse = useContinuousReversePlayback({
    ...params,
    onSeek: (time) => {
      let owner = held.current;
      if (
        owner &&
        (getNativePlayback() !== owner.native ||
          owner.native.commandRevision !== owner.revision)
      ) {
        held.current = null;
        reverse.stopReversePlayback();
        return;
      }
      if (owner && owner.native.snapshot().phase !== 'active') {
        held.current = null;
        if (!owner.native.isFallingBack) {
          reverse.stopReversePlayback();
          return;
        }
        owner = null;
      }
      // Keep the original rAF -> input event -> package-clock route. No queue.
      const revision = owner?.revision;
      params.onSeek(time);
      if (owner) {
        if (held.current !== owner) return;
        if (
          getNativePlayback() !== owner.native ||
          owner.native.commandRevision !== (revision ?? 0) + 1
        ) {
          held.current = null;
          reverse.stopReversePlayback();
          return;
        }
        // A supported input can initiate original-source recovery. Keep the
        // existing input route there, but never anchor it using a hidden image.
        if (owner.native.snapshot().phase !== 'active') {
          held.current = null;
          return;
        }
        owner.revision = owner.native.commandRevision;
        owner.sought = true;
        owner.atBoundary = time <= (params.minimumTime ?? 0);
      }
    },
  });
  const cancel = useCallback((): void => {
    held.current = null;
    reverse.stopReversePlayback();
  }, [reverse.stopReversePlayback]);
  const start = useCallback(
    (rate: ReversePlaybackRate): void => {
      cancel();
      const current = getNativePlayback();
      const native = current?.snapshot().phase === 'active' ? current : null;
      // Same pause/rate requested by the Screen; establish ownership before rAF.
      native?.controls({ playing: false, rate: 1 });
      held.current = native
        ? {
            native,
            revision: native.commandRevision,
            sought: false,
            atBoundary: false,
          }
        : null;
      reverse.startReversePlayback(rate);
    },
    [cancel, reverse.startReversePlayback],
  );
  const finish = useCallback((): void => {
    const owner = held.current;
    cancel();
    if (
      !owner ||
      !owner.sought ||
      owner.atBoundary ||
      getNativePlayback() !== owner.native ||
      owner.native.commandRevision !== owner.revision ||
      owner.native.snapshot().phase !== 'active' ||
      owner.native.requestedControls.playing
    )
      return;
    const displayedTime = nativePresentedTime(owner.native);
    if (
      !owner.native.hasConfirmedSeek &&
      !owner.native.finishPendingSeek(displayedTime, owner.revision)
    )
      return;
    // React's confirmed clock can be unchanged: reset the discarded local target.
    reverse.stopReversePlayback(displayedTime);
  }, [cancel, reverse.stopReversePlayback]);
  useEffect(() => cancel, [cancel, videoList]);
  return {
    startReversePlayback: start,
    stopReversePlayback: cancel,
    finishReversePlayback: finish,
  };
};
