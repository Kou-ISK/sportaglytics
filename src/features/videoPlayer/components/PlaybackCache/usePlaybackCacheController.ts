import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackCacheSnapshot } from '../../../../types/ipc/playbackCache';
import type { CachePlayerRegistration } from './CachePlayerContext';
import { snapshotCachePlayer, switchCachePlayer } from './cachePlayerSwitch';
import { isCacheRecoveryCurrent } from './cacheRecoveryRequest';
import type { CacheRecoveryRequest } from './cacheRecoveryRequest';

interface PlaybackCacheController {
  context: { register: (registration: CachePlayerRegistration) => () => void };
  snapshot: PlaybackCacheSnapshot | null;
  error: string | null;
  switching: boolean;
  onPrepare: () => void;
  onReuse: () => void;
  onCancel: () => void;
  onRetryCleanup: () => void;
  onUseCache: () => void;
  onUseOriginal: () => void;
  onRetryOriginal: (() => void) | null;
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
  const [retry, setRetry] = useState<CacheRecoveryRequest | null>(null);
  const retryRef = useRef(retry);
  retryRef.current = retry;
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
  const recoveryAttempted = useRef(new Set<CachePlayerRegistration>());
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
        if (retryRef.current?.player === registration) retryRef.current = null;
        setRetry((value) => (value?.player === registration ? null : value));
        recoveryAttempted.current.delete(registration);
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
    async (
      command: 'prepare' | 'reuse' | 'cancel' | 'cleanup',
    ): Promise<void> => {
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
    async (
      cache: boolean,
      recovery = false,
      manual = false,
      pending: CacheRecoveryRequest | null = null,
    ): Promise<void> => {
      if (!api || switchAbort.current || (playingRef.current && !recovery))
        return;
      const current = snapshotRef.current;
      if (pending && !isCacheRecoveryCurrent(pending, current, players.current))
        return;
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
      let restored = false;
      let savedTimeline = timelineRef.current;
      let expectedAudioTracks =
        pending?.audioTracks ??
        current.source.audioTracks ??
        selectedAudioTracks.current;
      let saved: ReturnType<typeof snapshotCachePlayer> | undefined;
      const input = request();
      try {
        if (pending) {
          // A polling snapshot can lag a Session change. Reserve the switch,
          // then revalidate against Main before touching the mounted media.
          const fresh = await api.inspect();
          controller.signal.throwIfAborted();
          if (
            !alive.current ||
            playingRef.current ||
            !isCacheRecoveryCurrent(pending, fresh, players.current) ||
            !isCacheRecoveryCurrent(
              pending,
              snapshotRef.current,
              players.current,
            ) ||
            !player.port.paused()
          )
            throw Error('CACHE_PLAYER_CHANGED');
        }
        if (recovery) {
          pauseRef.current();
          player.port.pause();
        } else snapshotCachePlayer(player.port);
        const candidate = cache ? await api.candidate(input) : null;
        controller.signal.throwIfAborted();
        if ((!recovery && playingRef.current) || !players.current.has(player))
          throw Error('CACHE_PLAYER_CHANGED');
        saved = pending
          ? {
              time: Math.max(
                0,
                pending.saved.time + timelineRef.current - pending.timeline,
              ),
              settings: {
                ...pending.saved.settings,
                audio: pending.saved.settings.audio?.slice() ?? null,
              },
            }
          : recovery
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
        setRetry(null);
        if (recovery && !manual && alive.current)
          setError(
            '再生用コピーで問題が発生したため、同じ位置の原本へ戻して停止しました。音声と映像を確認してから再開してください。',
          );
      } catch {
        pauseRef.current();
        if (players.current.has(player)) player.port.pause();
        recoveryAttempted.current.add(player);
        if (cache && changed && saved && players.current.has(player)) {
          pauseRef.current();
          saved.time = Math.max(
            0,
            saved.time + timelineRef.current - savedTimeline,
          );
          savedTimeline = timelineRef.current;
          // Separate bounded rollback after cancellation; never let an aborted
          // candidate signal skip restoring the original at the saved time.
          const rollback = new AbortController();
          switchAbort.current = rollback;
          try {
            await switchCachePlayer(
              player.port,
              player.source,
              saved,
              expectedAudioTracks,
              rollback.signal,
            );
            rollback.signal.throwIfAborted();
            await api.selected({ ...input, ticket: null });
            rollback.signal.throwIfAborted();
            player.suppressMetadata(false);
            selected.current = null;
            await refresh();
            rollback.signal.throwIfAborted();
            restored = true;
          } catch {
            player.port.pause();
          } finally {
            if (switchAbort.current === rollback)
              switchAbort.current = controller;
          }
        }
        if (alive.current && changed && saved) {
          setRetry(
            restored
              ? null
              : {
                  ...input,
                  player,
                  saved: {
                    time: saved.time,
                    settings: {
                      ...saved.settings,
                      audio: saved.settings.audio?.slice() ?? null,
                    },
                  },
                  timeline: savedTimeline,
                  audioTracks: expectedAudioTracks,
                },
          );
        }
        if (alive.current)
          setError(
            restored
              ? '切替を完了できませんでした。同じ位置の原本へ戻して停止しました。'
              : '切替を完了できず、原本への復旧は未確認です。停止状態で映像と音声を確認し、原本への切替を再試行してください。',
          );
      } finally {
        if (switchAbort.current === controller) switchAbort.current = null;
        if (alive.current) setSwitching(false);
      }
    },
    [api, refresh, request],
  );
  recover.current = () => {
    const player = selected.current;
    if (!player || recoveryAttempted.current.has(player)) return;
    recoveryAttempted.current.add(player);
    pauseRef.current();
    player.port.pause();
    void useSource(false, true);
  };
  // A changed document/clip cannot continue using an old selected cache.
  useEffect(() => {
    const player = selected.current;
    if (switching || !player || snapshot?.status.selected === 'cache') return;
    pauseRef.current();
    player.port.pause();
    if (snapshot?.source?.url === player.source) recover.current();
  }, [snapshot, switching, useSource]);
  const retryOriginal = (): void => {
    const pending = retryRef.current;
    if (
      !eligible ||
      playingRef.current ||
      switchAbort.current ||
      !pending ||
      !alive.current ||
      !isCacheRecoveryCurrent(pending, snapshotRef.current, players.current) ||
      !pending.player.port.paused()
    )
      return;
    recoveryAttempted.current.clear();
    void useSource(false, true, true, pending);
  };
  return {
    context,
    snapshot,
    error,
    switching,
    onRetryOriginal:
      retry &&
      eligible &&
      !playing &&
      !switching &&
      isCacheRecoveryCurrent(retry, snapshot, players.current) &&
      retry.player.port.paused()
        ? retryOriginal
        : null,
    onPrepare: () => {
      void action('prepare');
    },
    onReuse: () => {
      void action('reuse');
    },
    onCancel: () => {
      void action('cancel');
    },
    onRetryCleanup: () => {
      void action('cleanup');
    },
    onUseCache: () => {
      recoveryAttempted.current.clear();
      void useSource(true);
    },
    onUseOriginal: () => {
      if (retryRef.current) {
        retryOriginal();
        return;
      }
      recoveryAttempted.current.clear();
      void useSource(false, true, true);
    },
  };
};
