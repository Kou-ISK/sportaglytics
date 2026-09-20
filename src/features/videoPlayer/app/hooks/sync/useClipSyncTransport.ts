import { useEffect, useRef, useState } from 'react';
import { useClipSyncPreview } from './useClipSyncPreview';
import { getClipSyncOverlap } from './clipSyncPresentation';
import type { useClipTimelineSyncController } from './useClipTimelineSyncController';

type Controller = ReturnType<typeof useClipTimelineSyncController>;
type Side = 'reference' | 'target';

interface ClipSyncTransport {
  first: ReturnType<typeof useClipSyncPreview>;
  second: ReturnType<typeof useClipSyncPreview>;
  active: Side;
  setActive: (side: Side) => void;
  linked: boolean;
  frameRate: number;
  setFrameRate: (rate: number) => void;
  ready: boolean;
  canLink: boolean;
  busy: boolean;
  referencePoint: number;
  targetPoint: number;
  seek: (side: Side, time: number) => void;
  toggle: (side: Side) => void;
  step: (side: Side, seconds: number) => void;
  select: (side: Side, id: string) => void;
  onLink: () => void;
  beforeEdit: () => void;
}

export const useClipSyncTransport = (
  controller: Controller,
): ClipSyncTransport => {
  const { reference, target, placements, offsetFor, recordClipDuration } =
    controller;
  const [active, setActive] = useState<Side>('reference');
  const [linked, setLinked] = useState(false);
  const [frameRate, setFrameRate] = useState(30);
  const first = useClipSyncPreview(
    'sync_reference_clip',
    reference?.source ?? '',
    recordClipDuration(reference?.id ?? ''),
  );
  const second = useClipSyncPreview(
    'sync_target_clip',
    target?.source ?? '',
    recordClipDuration(target?.id ?? ''),
  );
  const referenceStart = reference
    ? (placements[reference.id] ?? reference.timelineStartSeconds) -
      offsetFor(reference)
    : 0;
  const targetStart = target
    ? (placements[target.id] ?? target.timelineStartSeconds) - offsetFor(target)
    : 0;
  const delta = referenceStart - targetStart;
  const overlap = getClipSyncOverlap(
    first.durationSec,
    second.durationSec,
    delta,
  );
  const busy = controller.isApplying || controller.isAnalyzing;
  const ready =
    first.isReady && second.isReady && !first.error && !second.error;
  const canLink = ready && !!overlap && reference?.id !== target?.id;
  const pause = (): void => {
    first.pause();
    second.pause();
  };
  const seek = (side: Side, time: number): void => {
    pause();
    if (linked && overlap) {
      const referenceTime = Math.min(
        overlap.end,
        Math.max(overlap.start, side === 'reference' ? time : time - delta),
      );
      first.seek(referenceTime);
      second.seek(referenceTime + delta);
    } else (side === 'reference' ? first : second).seek(time);
  };
  const toggle = (side: Side): void => {
    if (busy) return;
    if (linked && overlap) {
      if (first.playing || second.playing) {
        pause();
        return;
      }
      const time =
        first.time >= overlap.end - 0.05 ? overlap.start : first.time;
      seek('reference', time);
      first.play();
      second.play();
    } else {
      const player = side === 'reference' ? first : second;
      if (player.playing) player.pause();
      else {
        if (player.time >= player.durationSec - 0.01) player.seek(0);
        player.play();
      }
    }
  };
  const step = (side: Side, seconds: number): void => {
    const player = side === 'reference' ? first : second;
    seek(
      side,
      (player.playerRef.current?.currentTime() ?? player.time) + seconds,
    );
  };
  const current = useRef({
    first,
    second,
    overlap,
    delta,
    busy,
    active,
    toggle,
    step,
    pause,
  });
  current.current = {
    first,
    second,
    overlap,
    delta,
    busy,
    active,
    toggle,
    step,
    pause,
  };
  useEffect(() => {
    setLinked(false);
    current.current.pause();
  }, [reference?.id, target?.id]);
  useEffect(() => {
    if (busy) {
      setLinked(false);
      current.current.pause();
    }
  }, [busy]);
  useEffect(() => {
    if (!linked || !canLink) return;
    let frame = 0;
    const follow = (): void => {
      const state = current.current;
      const a = state.first.playerRef.current;
      const b = state.second.playerRef.current;
      if (a && b && state.overlap && !state.busy) {
        const time = a.currentTime() ?? 0;
        if (time >= state.overlap.end) state.pause();
        const targetTime =
          Math.min(state.overlap.end, Math.max(state.overlap.start, time)) +
          state.delta;
        if (
          Math.abs((b.currentTime() ?? 0) - targetTime) >
          (a.paused() ? 0.008 : 0.06)
        )
          state.second.seek(targetTime);
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [linked, canLink]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        element.closest(
          'input, textarea, select, button, [contenteditable="true"], [role="combobox"], [role="menu"]',
        )
      )
        return;
      if (![' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const state = current.current;
      if (state.busy) return;
      if (event.key === ' ') {
        if (!event.repeat) state.toggle(state.active);
      } else
        state.step(
          state.active,
          (event.key === 'ArrowLeft' ? -1 : 1) *
            (event.shiftKey ? 1 : 1 / frameRate),
        );
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [frameRate]);

  const select = (side: Side, id: string): void => {
    pause();
    setLinked(false);
    setActive(side);
    (side === 'reference' ? controller.setReferenceId : controller.setTargetId)(
      id,
    );
  };
  return {
    first,
    second,
    active,
    setActive,
    linked,
    frameRate,
    setFrameRate,
    ready,
    canLink,
    busy,
    referencePoint: referenceStart + first.time,
    targetPoint: targetStart + second.time,
    seek,
    toggle,
    step,
    select,
    onLink: (): void => {
      pause();
      if (!linked && overlap) {
        const time = Math.min(overlap.end, Math.max(overlap.start, first.time));
        first.seek(time);
        second.seek(time + delta);
      }
      setLinked(!linked);
    },
    beforeEdit: (): void => {
      pause();
      setLinked(false);
    },
  };
};
