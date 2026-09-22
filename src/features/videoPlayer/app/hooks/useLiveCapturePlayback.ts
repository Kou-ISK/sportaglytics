import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  CaptureSnapshot,
  CaptureTimelineState,
} from '../../../../types/liveCapture';
import type { PackageMediaAngle } from '../../../../types/package/media';

interface CapturePlaybackParameters {
  packagePath: string;
  currentTime: number;
  isPlaying: boolean;
  maxSec: number;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
  onSeek: (event: Event, time: number) => void;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setRate: Dispatch<SetStateAction<number>>;
}

export const useLiveCapturePlayback = (
  params: CapturePlaybackParameters,
): {
  timelineState: CaptureTimelineState | undefined;
  goLive: () => void;
} => {
  const [snapshot, setSnapshot] = useState<CaptureSnapshot | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const startedSession = useRef('');

  useEffect(() => {
    setSnapshot(null);
    startedSession.current = '';
    if (!params.packagePath || !window.electronAPI?.liveCapture) return;
    let mounted = true;
    let mediaKey = '';
    let latestElapsed = -1;
    let latestSession = '';
    let interacted = false;
    const markInteraction = (): void => {
      interacted = true;
    };
    window.addEventListener('pointerdown', markInteraction);
    window.addEventListener('keydown', markInteraction);
    const receive = (state: CaptureSnapshot | null): void => {
      if (!mounted || !state) return;
      if (state.id === latestSession && state.elapsedSeconds < latestElapsed)
        return;
      latestSession = state.id;
      latestElapsed = state.elapsedSeconds;
      setSnapshot(state);
      const nextKey = state.inputs
        .map((input) => `${input.id}:${input.segmentCount}`)
        .join('|');
      const angles = state.mediaAngles.filter(
        (angle) => angle.clips.length > 0,
      );
      if (nextKey === mediaKey || !angles.length) return;
      mediaKey = nextKey;
      paramsRef.current.setMediaAngles(angles);
      const sources = angles.map((angle) => angle.clips[0].source);
      paramsRef.current.setVideoList((previous) =>
        previous.join('|') === sources.join('|') ? previous : sources,
      );
      // Buffer two completed segments so normal playback does not stop at every append.
      if (
        startedSession.current !== state.id &&
        state.phase === 'recording' &&
        state.availableEndSeconds >= 6
      ) {
        startedSession.current = state.id;
        if (interacted || paramsRef.current.currentTime > 0.1) return;
        paramsRef.current.onSeek(
          new Event('capture-live'),
          Math.max(0, state.availableEndSeconds - 4),
        );
        paramsRef.current.setRate(1);
        paramsRef.current.setPlaying(true);
      }
    };
    const unsubscribe = window.electronAPI.liveCapture.onState(receive);
    void window.electronAPI.liveCapture
      .getState()
      .then(receive)
      .catch(() => undefined);
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
    };
  }, [params.packagePath]);

  const active =
    snapshot?.phase === 'recording' || snapshot?.phase === 'stopping';
  const goLive = useCallback((): void => {
    const edge = snapshot?.availableEndSeconds ?? paramsRef.current.maxSec;
    paramsRef.current.onSeek(
      new Event('capture-live'),
      active ? Math.max(0, edge - 4) : edge,
    );
    paramsRef.current.setRate(1);
    paramsRef.current.setPlaying(active);
  }, [active, snapshot?.availableEndSeconds]);

  const following =
    params.isPlaying &&
    (snapshot?.availableEndSeconds ?? 0) - params.currentTime <= 6;
  const interrupted =
    snapshot?.inputs.some((input) => input.phase === 'disconnected') ?? false;
  const availableEndSeconds = snapshot?.availableEndSeconds ?? 0;
  const timelineState = useMemo<CaptureTimelineState | undefined>(
    () =>
      active
        ? {
            availableEndSeconds,
            following,
            interrupted,
          }
        : undefined,
    [active, availableEndSeconds, following, interrupted],
  );
  return { goLive, timelineState };
};
