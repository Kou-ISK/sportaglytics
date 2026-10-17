import { useEffect, useRef, useState } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { readCaptureFragment } from './readCaptureFragment';
import { CaptureMediaBuffer } from './CaptureMediaBuffer';

export const useCaptureMediaSource = (
  angle: PackageMediaAngle | undefined,
  time: number,
  complete = true,
): { source: string; failed: boolean } => {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  const latest = useRef({ angle, time, complete });
  latest.current = { angle, time, complete };
  const enabled = angle?.playbackFormat === 'fragmented-mp4';
  useEffect(() => {
    setSource('');
    setFailed(false);
    if (!enabled) return;
    if (typeof MediaSource === 'undefined') {
      setFailed(true);
      return;
    }
    const media = new MediaSource();
    const url = URL.createObjectURL(media);
    const buffer = new CaptureMediaBuffer(media, readCaptureFragment, () =>
      setFailed(true),
    );
    const update = (): void =>
      buffer.update(
        latest.current.angle?.clips ?? [],
        latest.current.time,
        latest.current.complete,
      );
    update();
    const timer = setInterval(update, 200);
    setSource(url);
    return () => {
      clearInterval(timer);
      buffer.dispose();
      URL.revokeObjectURL(url);
    };
  }, [angle?.id, enabled]);
  return { source: failed ? '' : source, failed };
};
