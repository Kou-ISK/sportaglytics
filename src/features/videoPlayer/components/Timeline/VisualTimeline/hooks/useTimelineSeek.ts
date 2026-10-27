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
  useEffect(
    () => () => {
      const last = gesture.current;
      gesture.current = null;
      last?.commit(last.time, 'scrub');
    },
    [],
  );
  const seek = useCallback(
    (event: PointerEvent<HTMLElement>, mode: VideoSeekMode): void => {
      event.stopPropagation();
      const time = positionToTime(clientXToContentX(event.clientX));
      const commit = gesture.current?.commit ?? onSeek;
      gesture.current =
        mode === 'preview' ? { pointer: event.pointerId, time, commit } : null;
      commit(time, mode);
    },
    [clientXToContentX, positionToTime, onSeek],
  );
  const cancel = (event: PointerEvent<HTMLElement>): void => {
    const last = gesture.current;
    if (!last || last.pointer !== event.pointerId) return;
    gesture.current = null;
    last.commit(last.time, 'scrub');
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = null;
      seek(event, 'preview');
    },
    onPointerMove: (event) => {
      if (
        gesture.current &&
        gesture.current.pointer === event.pointerId &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      )
        seek(event, 'preview');
    },
    onPointerUp: (event) => {
      if (
        !gesture.current ||
        gesture.current.pointer !== event.pointerId ||
        !event.currentTarget.hasPointerCapture(event.pointerId)
      )
        return;
      seek(event, 'scrub');
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  };
};
