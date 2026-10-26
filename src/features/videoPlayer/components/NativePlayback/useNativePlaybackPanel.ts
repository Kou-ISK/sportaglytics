import { hasNativeSurface } from '../../shared/nativePlayback/nativeSurfaceBinding';
import { nativeStartUnavailableReason } from '../../shared/nativePlayback/nativeStartAvailability';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CachePlayerRegistration } from '../PlaybackCache/CachePlayerContext';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import { parseNativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import type { NativePlaybackControls } from '../../shared/nativePlayback/nativePlaybackController';
import { openQualifiedNativePlayback } from '../../shared/nativePlayback/nativePlaybackGateway';
import { useNativePlaybackState } from '../../shared/nativePlayback/useNativePlaybackState';
import type { NativePlaybackPanelViewProps } from './NativePlaybackPanelView';

export const useNativePlaybackPanel = (
  eligible: boolean,
  playing: boolean,
  pause: () => void,
  restored: (time: number, controls: NativePlaybackControls) => void,
): {
  register: (player: CachePlayerRegistration) => () => void;
  view: NativePlaybackPanelViewProps | null;
} => {
  const players = useRef(new Set<CachePlayerRegistration>());
  const [revision, setRevision] = useState(0);
  const [, setSettingsRevision] = useState(0);
  const [availability, setAvailability] =
    useState<NativePlaybackAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const { controller, state } = useNativePlaybackState();
  const current = useRef({ eligible, pause, restored });
  current.current = { eligible, pause, restored };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const register = useCallback(
    (player: CachePlayerRegistration): (() => void) => {
      players.current.add(player);
      setRevision((value) => value + 1);
      const changed = (): void => setSettingsRevision((value) => value + 1);
      const events = ['volumechange', 'ratechange', 'seeked'];
      events.forEach((event) => player.port.on(event, changed));
      return () => {
        players.current.delete(player);
        events.forEach((event) => player.port.off(event, changed));
        setRevision((value) => value + 1);
      };
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const api = window.electronAPI;
    if (
      !eligible ||
      !api?.nativeSurface ||
      players.current.size !== 1 ||
      controller
    )
      return;
    void api.nativePlayback
      .inspect()
      .then((raw) => {
        if (!cancelled) setAvailability(parseNativePlaybackAvailability(raw));
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, revision, controller]);
  const act = useCallback(
    (work: () => Promise<void>, opening = false): void => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setError(null);
      void work()
        .catch(() => {
          if (alive.current)
            setError(
              opening
                ? '試用を開始できませんでした。原本プレイヤーの状態を確認してください。'
                : '原本の再生状態を確認できませんでした。再生を停止してから原本へ戻してください。',
            );
        })
        .finally(() => {
          working.current = false;
          if (alive.current) setBusy(false);
        });
    },
    [],
  );
  const onOpen = useCallback(
    (): void =>
      act(async () => {
        const api = window.electronAPI;
        if (!api?.nativeSurface) throw Error('NATIVE_PRESENTATION_UNAVAILABLE');
        const player = [...players.current][0];
        if (!current.current.eligible || players.current.size !== 1 || !player)
          throw Error('NATIVE_PLAYER_CHANGED');
        const fresh = parseNativePlaybackAvailability(
          await api.nativePlayback.inspect(),
        );
        const assertCurrent = (): void => {
          if (
            !alive.current ||
            !current.current.eligible ||
            players.current.size !== 1 ||
            !players.current.has(player) ||
            player.port.source() !== fresh.sourceUrl
          )
            throw Error('NATIVE_PLAYER_CHANGED');
        };
        assertCurrent();
        if (
          !fresh.presentation ||
          !api.nativeSurface ||
          !fresh.sourceUrl ||
          !hasNativeSurface(fresh.sourceUrl)
        )
          throw Error('NATIVE_PRESENTATION_UNAVAILABLE');
        setAvailability(fresh);
        if (
          nativeStartUnavailableReason(
            fresh.presentation,
            player.port.time(),
            player.port.settings(),
            !player.port.paused(),
          )
        ) {
          setSettingsRevision((value) => value + 1);
          return;
        }
        openQualifiedNativePlayback(
          fresh,
          player.port,
          () => current.current.pause(),
          assertCurrent,
          (time, controls) => current.current.restored(time, controls),
        );
      }, true),
    [act],
  );
  const onOriginal = useCallback(
    (): void =>
      act(async () => {
        current.current.pause();
        await controller?.returnToOriginal();
      }),
    [act, controller],
  );
  const currentPlayer = [...players.current][0];
  const settings = currentPlayer?.port.settings();
  const targetTime = currentPlayer?.port.time() ?? 0;
  const unavailableReason =
    availability?.presentation && settings
      ? nativeStartUnavailableReason(
          availability.presentation,
          targetTime,
          settings,
          playing,
        )
      : '原本プレイヤーの準備を待っています。';
  const controls = controller?.requestedControls;
  const updateAudio = useCallback(
    (change: Partial<NativePlaybackControls>): void => {
      if (controller) {
        controller.controls(change);
        return;
      }
      const player = [...players.current][0];
      if (!player || players.current.size !== 1) return;
      try {
        const saved = player.port.settings();
        const count = saved.audio?.length ?? 0;
        if (!count) throw Error('NATIVE_AUDIO_SELECTION_UNAVAILABLE');
        player.port.restore(
          {
            ...saved,
            ...change,
            audio:
              change.audioTrack === undefined
                ? saved.audio
                : saved.audio!.map((_, index) => index === change.audioTrack),
          },
          count,
        );
        setSettingsRevision((value) => value + 1);
      } catch {
        setError('音声の選択状態を確認できませんでした。');
      }
    },
    [controller],
  );
  const audioTrack =
    controls?.audioTrack ?? settings?.audio?.findIndex(Boolean) ?? -1;
  const muted = controls?.muted ?? settings?.muted ?? true;
  const view = useMemo<NativePlaybackPanelViewProps | null>(() => {
    if (
      !eligible ||
      !availability?.presentation ||
      !window.electronAPI?.nativeSurface
    )
      return null;
    return {
      mode:
        state.phase === 'failed'
          ? 'failed'
          : state.phase === 'closing'
            ? 'restoring'
            : controller
              ? 'native'
              : 'original',
      canOpen: !busy && unavailableReason === null,
      unavailableReason,
      error:
        error ??
        (state.error
          ? '再生処理を確認できません。原本への復帰を確認するまで停止しています。'
          : null),
      audioTracks: availability.presentation.audioTracks,
      audioTrack,
      muted,
      onOpen,
      onOriginal,
      onAudio: (track) => updateAudio({ audioTrack: track }),
      onMute: () => updateAudio({ muted: !muted }),
    };
  }, [
    eligible,
    availability,
    state.phase,
    state.error,
    controller,
    playing,
    busy,
    settings?.audio,
    unavailableReason,
    error,
    audioTrack,
    muted,
    onOpen,
    onOriginal,
    updateAudio,
  ]);
  return { register, view };
};
