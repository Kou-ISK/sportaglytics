import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackCacheSnapshot } from '../../../../types/ipc/playbackCache';
import type { CachePlayerRegistration } from './CachePlayerContext';
import { snapshotCachePlayer, switchCachePlayer } from './cachePlayerSwitch';

interface PlaybackCacheController {
  context: { register: (registration: CachePlayerRegistration) => () => void };
  snapshot: PlaybackCacheSnapshot | null;
  error: string | null;
  switching: boolean;
  onPrepare: () => void;
  onCancel: () => void;
  onRetryCleanup: () => void;
  onUseCache: () => void;
  onUseOriginal: () => void;
}
/** Session data and videoList remain the original; only the mounted player changes. */
export const usePlaybackCacheController = (
  eligible: boolean,
  playing: boolean,
  timelineTime: number,
  pause: () => void,
): PlaybackCacheController => {
  const [snapshot, setSnapshot] = useState<PlaybackCacheSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const timelineRef = useRef(timelineTime);
  timelineRef.current = timelineTime;
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const refreshId = useRef(0);
  const players = useRef(new Set<CachePlayerRegistration>());
  const switchAbort = useRef<AbortController | null>(null);
  const selected = useRef<CachePlayerRegistration | null>(null);
  const selectedAudioTracks = useRef(0);
  const recover = useRef<() => void>(() => undefined);
  const alive = useRef(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const api = window.electronAPI?.playbackCache;
  const refresh = useCallback(async (): Promise<void> => {
    if (!api || !eligible) return;
    const id = ++refreshId.current;
    const next = await api.inspect();
    if (alive.current && id === refreshId.current) setSnapshot(next);
  }, [api, eligible]);
  const register = useCallback(
    (registration: CachePlayerRegistration): (() => void) => {
      players.current.add(registration);
      const failed = (): void => {
        if (switchAbort.current) switchAbort.current.abort();
        else if (selected.current === registration) recover.current();
      };
      registration.port.on('error', failed);
      return () => {
        registration.port.off('error', failed);
        players.current.delete(registration);
        switchAbort.current?.abort();
        if (selected.current === registration) selected.current = null;
      };
    },
    [],
  );
  const context = useMemo(() => ({ register }), [register]);
  useEffect(() => {
    alive.current = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async (): Promise<void> => {
      try {
        await refresh();
      } catch {
        if (!stopped) setError('再生用コピーの状態を取得できませんでした。');
      }
      if (!stopped)
        timer = setTimeout(() => {
          void poll();
        }, 1000);
    };
    if (eligible) void poll();
    return () => {
      stopped = true;
      alive.current = false;
      clearTimeout(timer);
      switchAbort.current?.abort();
    };
  }, [eligible, refresh]);
  useEffect(() => {
    if (playing) switchAbort.current?.abort();
  }, [playing]);
  useEffect(() => {
    switchAbort.current?.abort();
  }, [timelineTime]);
  const request = useCallback(() => {
    const value = snapshotRef.current;
    if (!api || !value?.source) throw Error('CACHE_UNAVAILABLE');
    return { generation: value.generation, sourceKey: value.source.key };
  }, [api]);
  const action = useCallback(
    async (command: 'prepare' | 'cancel' | 'cleanup'): Promise<void> => {
      try {
        setError(null);
        await api?.[command](request());
        await refresh();
      } catch {
        setError(
          '処理を完了できませんでした。状態を確認して再試行してください。',
        );
      }
    },
    [api, refresh, request],
  );
  const useSource = useCallback(
    async (cache: boolean, recovery = false): Promise<void> => {
      if (!api || switchAbort.current || (playingRef.current && !recovery))
        return;
      const current = snapshotRef.current;
      const registrations = [...players.current];
      const player = registrations[0];
      if (
        !current?.source ||
        registrations.length !== 1 ||
        player?.source !== current.source.url
      ) {
        setError('この再生画面ではコピーへ切り替えられません。');
        return;
      }
      const controller = new AbortController();
      switchAbort.current = controller;
      setSwitching(true);
      setError(null);
      let changed = false;
      let savedTimeline = timelineRef.current;
      let expectedAudioTracks =
        current.source.audioTracks ?? selectedAudioTracks.current;
      let saved: ReturnType<typeof snapshotCachePlayer> | undefined;
      const input = request();
      try {
        if (recovery) {
          pauseRef.current();
          player.port.pause();
        } else snapshotCachePlayer(player.port);
        const candidate = cache ? await api.candidate(input) : null;
        controller.signal.throwIfAborted();
        if ((!recovery && playingRef.current) || !players.current.has(player))
          throw Error('CACHE_PLAYER_CHANGED');
        saved = recovery
          ? { time: player.port.time(), settings: player.port.settings() }
          : snapshotCachePlayer(player.port);
        if (!Number.isFinite(saved.time) || saved.time < 0)
          throw Error('CACHE_PLAYER_TIME');
        savedTimeline = timelineRef.current;
        // Require audio-selection visibility before changing a multi-track source.
        const count = candidate?.audioTracks ?? expectedAudioTracks;
        expectedAudioTracks = count;
        if (count > 1 && saved.settings.audio?.length !== count)
          throw Error('CACHE_AUDIO_SELECTION_UNAVAILABLE');
        pauseRef.current();
        player.suppressMetadata(true);
        changed = true;
        await switchCachePlayer(
          player.port,
          candidate?.url ?? player.source,
          saved,
          count,
          controller.signal,
        );
        await api.selected({ ...input, ticket: candidate?.ticket ?? null });
        controller.signal.throwIfAborted();
        selected.current = cache ? player : null;
        selectedAudioTracks.current = count;
        player.suppressMetadata(cache);
        await refresh();
        controller.signal.throwIfAborted();
      } catch {
        if (changed && saved && players.current.has(player)) {
          selected.current = null;
          pauseRef.current();
          saved.time = Math.max(
            0,
            saved.time + timelineRef.current - savedTimeline,
          );
          // Separate bounded rollback after cancellation; never let an aborted
          // candidate signal skip restoring the original at the saved time.
          try {
            await switchCachePlayer(
              player.port,
              player.source,
              saved,
              expectedAudioTracks,
              new AbortController().signal,
            );
            player.suppressMetadata(false);
            selected.current = null;
          } catch {
            player.port.pause();
          }
        }
        try {
          await api.selected({ ...input, ticket: null });
        } catch {
          /* A newer Session owns state. */
        }
        if (alive.current)
          setError(
            '切替を完了できませんでした。原本の再生状態を確認してください。',
          );
      } finally {
        if (switchAbort.current === controller) switchAbort.current = null;
        if (alive.current) setSwitching(false);
      }
    },
    [api, refresh, request],
  );
  recover.current = () => {
    void useSource(false, true);
  };
  // A changed document/clip cannot continue using an old selected cache.
  useEffect(() => {
    const player = selected.current;
    if (switching || !player || snapshot?.status.selected === 'cache') return;
    pauseRef.current();
    player.port.pause();
    if (snapshot?.source?.url === player.source) void useSource(false, true);
  }, [snapshot, switching, useSource]);
  return {
    context,
    snapshot,
    error,
    switching,
    onPrepare: () => {
      void action('prepare');
    },
    onCancel: () => {
      void action('cancel');
    },
    onRetryCleanup: () => {
      void action('cleanup');
    },
    onUseCache: () => {
      void useSource(true);
    },
    onUseOriginal: () => {
      void useSource(false);
    },
  };
};
