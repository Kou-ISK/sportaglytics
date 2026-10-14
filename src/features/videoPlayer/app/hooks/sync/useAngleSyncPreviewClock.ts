import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface PreviewClockPlayer {
  currentTime: (seconds?: number) => number | undefined;
  isDisposed: () => boolean;
  seeking: () => boolean;
  paused: () => boolean;
  readyState: () => number;
  pause: () => void;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
}

interface PreviewClockParams {
  playerRef: RefObject<PreviewClockPlayer | null>;
  source: string;
  time: number | null;
  ready: boolean;
  waitForDecodedFrame: boolean;
  playing: boolean;
  suspended: boolean;
  error: string;
  play: () => void;
}

/** Source replacement can reset currentTime after the React readiness update. */
export const useAngleSyncPreviewClock = (params: PreviewClockParams): void => {
  const requested = useRef<
    { source: string; time: number; playing: boolean } | undefined
  >(undefined);
  const current = useRef(params);
  current.current = params;
  const apply = useCallback((): void => {
    const state = current.current;
    const player = state.playerRef.current;
    if (!state.ready || state.suspended || !player || player.isDisposed()) {
      requested.current = undefined;
      return;
    }
    if (state.time === null || state.error) {
      requested.current = undefined;
      player.pause();
      return;
    }
    if (!state.playing && !player.paused()) player.pause();
    // Metadata does not mean the replacement file has a decoded frame yet.
    // Seeking here can interrupt initial decoding on Windows and leave the
    // player indefinitely at HAVE_METADATA. loadeddata/canplay retry the latest
    // requested time; YouTube has its own readiness contract.
    if (
      player.seeking() ||
      (state.waitForDecodedFrame && player.readyState() < 2)
    )
      return;
    if (
      Math.abs((player.currentTime() ?? 0) - state.time) >
      (state.playing ? 0.08 : 0.00005)
    ) {
      // A decoder can clamp a target before the first frame. Do not restart an
      // unresolved paused request from canplay/seeked; a changed target/source
      // is still applied, and a successfully aligned request can be restored.
      if (
        !state.playing &&
        requested.current?.playing === false &&
        requested.current.source === state.source &&
        requested.current.time === state.time
      )
        return;
      requested.current = {
        source: state.source,
        time: state.time,
        playing: state.playing,
      };
      player.currentTime(state.time);
    } else requested.current = undefined;
    if (state.playing && player.paused()) state.play();
  }, []);

  useEffect(apply, [
    apply,
    params.time,
    params.playing,
    params.suspended,
    params.ready,
    params.waitForDecodedFrame,
    params.error,
    params.source,
  ]);
  useEffect(() => {
    const player = params.playerRef.current;
    if (!player) return;
    // Chromium/Video.js may finish replacing the source after loadedmetadata.
    // Reconcile on media readiness/seek completion, even when React state is unchanged.
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked'];
    events.forEach((event) => player.on(event, apply));
    return () => {
      if (!player.isDisposed())
        events.forEach((event) => player.off(event, apply));
    };
  }, [apply, params.playerRef, params.source]);
};
