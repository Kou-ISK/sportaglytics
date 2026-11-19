import { Slider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SliderProps } from '@mui/material';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

interface Props extends Pick<
  SliderProps,
  'aria-label' | 'sx' | 'disabled' | 'marks'
> {
  time: number;
  min: number;
  max: number;
  onPreview: (event: Event, value: number) => void;
  onCommit: (value: number) => void;
}

/** The thumb follows input while the media clock waits for a displayed frame. */
export const PlaylistScrubSlider = ({
  time,
  min,
  max,
  onPreview,
  onCommit,
  ...props
}: Props): ReactElement => {
  const track = useRef<HTMLSpanElement>(null);
  const pending = useRef<number | null>(null);
  const commitGesture = useRef(onCommit);
  const [thumb, setThumb] = useState<number | null>(null);
  const theme = useTheme();
  const timeAtX = (x: number, fallback: number): number => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect?.width) return fallback;
    const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    const raw = (theme.direction === 'rtl' ? 1 - ratio : ratio) * (max - min);
    return Math.min(max, min + Math.round(raw * 100) / 100);
  };
  const commit = (value: number): void => {
    pending.current = null;
    setThumb(null);
    commitGesture.current(value);
  };
  useEffect(() => {
    const finish = (): void => {
      if (pending.current !== null) {
        const last = pending.current;
        pending.current = null;
        setThumb(null);
        commitGesture.current(last);
      }
    };
    window.addEventListener('blur', finish);
    return () => window.removeEventListener('blur', finish);
  }, []);
  useLayoutEffect(
    () => () => {
      if (pending.current !== null) {
        const last = pending.current;
        pending.current = null;
        commitGesture.current(last);
      }
    },
    [],
  );
  return (
    <Slider
      {...props}
      ref={track}
      size="small"
      min={min}
      max={max}
      step={0.01}
      value={thumb ?? time}
      onPointerDownCapture={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        commitGesture.current = onCommit;
        const target = timeAtX(event.clientX, time);
        pending.current = target;
        setThumb(target);
        onPreview(event.nativeEvent, target);
      }}
      onPointerCancel={() => {
        if (pending.current !== null) commit(pending.current);
      }}
      onChange={(event, value) => {
        if (typeof value !== 'number') return;
        if (pending.current === value) return;
        if (pending.current === null) commitGesture.current = onCommit;
        pending.current = value;
        setThumb(value);
        onPreview(event, value);
      }}
      onChangeCommitted={(event, value) => {
        if (typeof value !== 'number') return;
        const native = 'nativeEvent' in event ? event.nativeEvent : event;
        if (pending.current === null) {
          if (!(native instanceof KeyboardEvent)) return;
          commitGesture.current = onCommit;
          onPreview(native, value);
        }
        const x =
          native instanceof MouseEvent
            ? native.clientX
            : 'changedTouches' in native && native instanceof TouchEvent
              ? native.changedTouches[0]?.clientX
              : undefined;
        commit(x === undefined ? value : timeAtX(x, value));
      }}
    />
  );
};
