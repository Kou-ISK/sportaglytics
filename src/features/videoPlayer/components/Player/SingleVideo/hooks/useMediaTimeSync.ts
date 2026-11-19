import { isConfirmedDisplayedFrame, issueVideoPresentationSeek } from '../../../../../../shared/media/waitForVideoPresentation';
import {
  htmlPlaybackAllowed,
  playbackAuthorityRevision,
  subscribePlaybackAuthority,
} from '../../../../shared/nativePlayback/playbackAuthority';
import { useSyncExternalStore } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
interface ClockPlayer {
  el?: () => Element | undefined;
  currentTime: (time?: number) => number | undefined;
  seeking: () => boolean;
  currentSrc?: () => string;
  duration?: () => number | undefined;
  seekable?: () => TimeRanges | undefined;
  on: (event: string, listener: () => void) => unknown;
  off: (event: string, listener: () => void) => unknown;
}

const canFinishPendingLocalSeek = (player: ClockPlayer): boolean => {
  try {
    const duration = player.duration?.();
    const ranges = player.seekable?.();
    const pendingTime = player.currentTime();
    return Boolean(
      player.currentSrc?.().startsWith('file://') &&
      duration !== undefined &&
      Number.isFinite(duration) &&
      duration > 0 &&
      ranges?.length === 1 &&
      ranges.start(0) <= 0 &&
      ranges.end(0) >= duration &&
      pendingTime !== undefined &&
      Number.isFinite(pendingTime) &&
      pendingTime >= 0 &&
      pendingTime <= duration,
    );
  } catch {
    return false;
  }
};

/** Coalesce seeks while decoding; native playback advances between corrections. */
export const useMediaTimeSync = (
  playerRef: MutableRefObject<ClockPlayer | null>,
  ready: boolean,
  targetTime: number | undefined,
  playing: boolean,
  rate = 1,
): void => {
  const authority = useSyncExternalStore(
    subscribePlaybackAuthority,
    playbackAuthorityRevision,
    playbackAuthorityRevision,
  );
  const latest = useRef({ targetTime, playing, rate, ready });
  const lastRequestedTime = useRef<number | undefined>(undefined);
  const force = useRef(true);
  const exactReverse = useRef(false);
  const pendingReverseTarget = useRef<{
    previous: number | undefined;
    source: string | undefined;
  } | null>(null);
  const waitForPendingSeek = useRef(false);
  useLayoutEffect(() => {
    if (latest.current.playing !== playing) pendingReverseTarget.current = null;
    // Returning from a recording gap must replace any unfinished old seek.
    if (latest.current.targetTime === undefined && targetTime !== undefined) {
      force.current = true;
      waitForPendingSeek.current = false;
    }
    if (
      latest.current.targetTime !== targetTime ||
      latest.current.playing !== playing
    )
      lastRequestedTime.current = undefined;
    latest.current = { targetTime, playing, rate, ready };
  }, [targetTime, playing, rate, ready]);
  const lastSeekAt = useRef(-Infinity);
  const sync = useCallback((): void => {
    const player = playerRef.current;
    const state = latest.current;
    if (
      !htmlPlaybackAllowed() ||
      !state.ready ||
      !player ||
      state.targetTime === undefined ||
      !Number.isFinite(state.targetTime) ||
      (player.seeking() && (!force.current || waitForPendingSeek.current))
    )
      return;
    if (pendingReverseTarget.current) {
      if (pendingReverseTarget.current.previous === state.targetTime) return;
      pendingReverseTarget.current = null;
    }
    const now = performance.now();
    const forced = force.current;
    const precise = forced || !state.playing;
    const tolerance =
      forced && exactReverse.current
        ? 0.000001
        : precise
          ? 0.015
          : 0.15 * Math.max(1, state.rate);
    if (!precise && now - lastSeekAt.current < 250) return;
    force.current = false;
    exactReverse.current = false;
    waitForPendingSeek.current = false;
    const video = player.el?.()?.querySelector('video');
    if (
      !forced &&
      !state.playing &&
      video instanceof HTMLVideoElement &&
      isConfirmedDisplayedFrame(video, state.targetTime)
    )
      return;
    if (Math.abs((player.currentTime() ?? 0) - state.targetTime) <= tolerance) {
      // A completed seek may later be reset by the source's load restoration.
      // Only an unresolved request is suppressed; an aligned frame can drift again.
      lastRequestedTime.current = undefined;
      return;
    }
    // A decoder may clamp a target before its first frame. Repeating that
    // unchanged paused request from seeked/canplay would restart decoding forever.
    if (
      !state.playing &&
      !forced &&
      lastRequestedTime.current === state.targetTime
    )
      return;
    lastSeekAt.current = now;
    lastRequestedTime.current = state.targetTime;
    const target = Math.max(0, state.targetTime);
    issueVideoPresentationSeek(video instanceof HTMLVideoElement ? video : null, () => { player.currentTime(target); });
  }, [playerRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !htmlPlaybackAllowed()) return;
    force.current = true;
    waitForPendingSeek.current = false;
    lastSeekAt.current = -Infinity;
    lastRequestedTime.current = undefined;
    const requestSeek = (event: Event): void => {
      force.current = true;
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : null;
      exactReverse.current =
        typeof detail === 'object' &&
        detail !== null &&
        'reverse' in detail &&
        detail.reverse === true;
      pendingReverseTarget.current = exactReverse.current
        ? { previous: latest.current.targetTime, source: player.currentSrc?.() }
        : null;
      // Finish one real image before decoding the latest drag position. Unknown
      // or evicted sources retain forced replacement because seeked may never arrive.
      waitForPendingSeek.current =
        player.seeking() && canFinishPendingLocalSeek(player);
    };
    const loading = (): void => {
      pendingReverseTarget.current = null;
      exactReverse.current = false;
    };
    const settled = (): void => {
      lastSeekAt.current = performance.now();
      sync();
    };
    const loaded = (): void => {
      const pending = pendingReverseTarget.current;
      if (
        pending &&
        pending.source !== undefined &&
        player.currentSrc?.() !== pending.source
      )
        pendingReverseTarget.current = null;
      // Some decoders reset the initial metadata seek when the first frame arrives.
      force.current = true;
      waitForPendingSeek.current = false;
      sync();
    };
    player.on('loadstart', loading);
    player.on('seeked', settled);
    player.on('loadeddata', loaded);
    player.on('canplay', sync);
    window.addEventListener('video-seek-start', requestSeek);
    sync();
    return () => {
      player.off('loadstart', loading);
      player.off('seeked', settled);
      player.off('loadeddata', loaded);
      player.off('canplay', sync);
      window.removeEventListener('video-seek-start', requestSeek);
      pendingReverseTarget.current = null;
    };
  }, [playerRef, ready, sync, authority]);

  useEffect(sync, [sync, ready, targetTime, playing, rate, authority]);
};
