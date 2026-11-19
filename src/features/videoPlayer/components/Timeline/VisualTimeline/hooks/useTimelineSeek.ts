import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { VideoSeekMode } from '../../../../../../types/video/seek';

export const useTimelineSeek = (
  clientXToContentX: (x: number) => number,
  positionToTime: (x: number) => number,
  onSeek: (time: number, mode?: VideoSeekMode) => void,
): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLElement>) => void;
} => {
  const gesture = useRef<{
    pointer: number;
    time: number;
    commit: typeof onSeek;
  } | null>(null);
  const outside = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      outside.current?.abort();
      const last = gesture.current;
      gesture.current = null;
      last?.commit(last.time, 'scrub');
    },
    [],
  );
  const seek = useCallback(
    (
      event: Pick<
        PointerEvent<HTMLElement>,
        'pointerId' | 'clientX' | 'stopPropagation'
      >,
      mode: VideoSeekMode,
    ): void => {
      event.stopPropagation();
      const time = positionToTime(clientXToContentX(event.clientX));
      const commit = gesture.current?.commit ?? onSeek;
      gesture.current =
        mode === 'preview' ? { pointer: event.pointerId, time, commit } : null;
      if (mode !== 'preview') outside.current?.abort();
      commit(time, mode);
    },
    [clientXToContentX, positionToTime, onSeek],
  );
  const cancel = (event: { pointerId: number }): void => {
    const last = gesture.current;
    if (!last || last.pointer !== event.pointerId) return;
    gesture.current = null;
    outside.current?.abort();
    last.commit(last.time, 'scrub');
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0 || gesture.current) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
        // The window listeners still own the gesture if there is no active capture.
      }
      const pointerId = event.pointerId;
      const listeners = new AbortController();
      outside.current = listeners;
      const options = { signal: listeners.signal };
      for (const [name, mode] of [
        ['pointermove', 'preview'],
        ['pointerup', 'scrub'],
      ] as const) {
        window.addEventListener(
          name,
          (next) => {
            if (gesture.current?.pointer === next.pointerId) seek(next, mode);
          },
          options,
        );
      }
      window.addEventListener('pointercancel', cancel, options);
      window.addEventListener('blur', () => cancel({ pointerId }), options);
      seek(event, 'preview');
    },
    onPointerMove: (event) => {
      if (gesture.current && gesture.current.pointer === event.pointerId)
        seek(event, 'preview');
    },
    onPointerUp: (event) => {
      if (!gesture.current || gesture.current.pointer !== event.pointerId)
        return;
      seek(event, 'scrub');
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  };
};
