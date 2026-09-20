import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { MediaTimeline } from '../../../shared/media/mediaTimeline';
import {
  getMediaTimelineEnd,
  resolveMediaTime,
  singleSourceTimeline,
} from '../../../shared/media/mediaTimeline';
import type { UsePlaylistPlaybackParams } from '../hooks/playlist/usePlaylistPlayback.types';
import { TimelineVideoAdapter } from './TimelineVideoAdapter';

interface TimelineCallbacks {
  onTime: (time: number) => void;
  onEnd: () => void;
}

export const usePlaylistMediaTimeline = (
  params: UsePlaylistPlaybackParams,
  callbacks: React.MutableRefObject<TimelineCallbacks>,
): {
  active: boolean;
  loading: boolean;
  error: string;
  retry: () => void;
  seek: (time: number) => boolean;
  resolve: (
    time: number,
    secondary: boolean,
  ) => ReturnType<typeof resolveMediaTime> | undefined;
} => {
  const { currentVideoSource: primary, currentVideoSource2: secondary } =
    params;
  const active = [primary, secondary].some(
    (source) => source && /\.stpkg[/\\]/i.test(source),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [resolved, setResolved] = useState<{
    key: string;
    timelines: Array<MediaTimeline | null>;
  } | null>(null);
  const sourceKey = JSON.stringify([primary, secondary]);
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  }, [params]);
  const adapters = useRef<Array<TimelineVideoAdapter | null>>([]);
  const time = useRef(0);
  const ended = useRef(false);
  const retry = useCallback((): void => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!active) return;
    const refresh = (): void => retry();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [active, retry]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const sources = [primary, secondary];
    setLoading(true);
    setError('');
    const api = window.electronAPI;
    void (async () => {
      if (!api?.resolveMediaTimelines)
        throw new Error('映像の同期情報を読み込めませんでした。');
      const available = sources.filter((source): source is string =>
        Boolean(source),
      );
      const result = await api.resolveMediaTimelines(available);
      let index = 0;
      const timelines = sources.map((source) =>
        source ? (result[index++] ?? singleSourceTimeline(source)) : null,
      );
      if (!disposed)
        setResolved((previous) =>
          previous?.key === sourceKey &&
          JSON.stringify(previous.timelines) === JSON.stringify(timelines)
            ? previous
            : { key: sourceKey, timelines },
        );
    })()
      .catch(() => {
        if (!disposed) {
          setError(
            '同期情報を読み込めません。パッケージと元映像の接続を確認し、再試行してください。',
          );
          latest.current.setIsPlaying(false);
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [active, primary, secondary, sourceKey, revision]);

  const itemKey = `${params.currentItem?.id}:${params.currentItem?.startTime}:${params.currentItem?.endTime}`;
  useEffect(() => {
    if (!active) return;
    time.current = latest.current.currentItem?.startTime ?? 0;
    ended.current = false;
    latest.current.setCurrentTime(time.current);
    latest.current.setIsFrozen(false);
  }, [active, itemKey]);

  useEffect(() => {
    if (!active || resolved?.key !== sourceKey) return;
    const videos = [
      latest.current.videoRef.current,
      latest.current.videoRef2.current,
    ];
    adapters.current = resolved.timelines.map((timeline, index) =>
      timeline && videos[index]
        ? new TimelineVideoAdapter(videos[index], timeline)
        : null,
    );
    latest.current.setDuration(
      Math.max(
        0,
        ...resolved.timelines.map((timeline) =>
          timeline ? getMediaTimelineEnd(timeline) : 0,
        ),
      ),
    );
    return () => {
      adapters.current.forEach((adapter) => adapter?.dispose());
      adapters.current = [];
    };
  }, [active, resolved, sourceKey]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previousTimestamp: number | undefined;
    const tick = (timestamp: number): void => {
      const current = latest.current;
      const players = adapters.current;
      const playing =
        current.isPlaying &&
        !current.isFrozen &&
        !loading &&
        !error &&
        resolved?.key === sourceKey;
      const elapsed =
        previousTimestamp === undefined
          ? 0
          : Math.min(0.1, Math.max(0, timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      try {
        // Prepare all sources before allowing any clock to advance.
        const readiness = players.map(
          (adapter) => adapter?.sync(time.current, playing) ?? true,
        );
        const ready = players.length > 0 && readiness.every(Boolean);
        if (!ready) players.forEach((adapter) => adapter?.video.pause());
        if (ready && playing) {
          const rate = current.videoRef.current?.playbackRate ?? 1;
          time.current = Math.min(
            current.currentItem?.endTime ?? Infinity,
            time.current + elapsed * rate,
          );
          players.forEach((adapter) => adapter?.sync(time.current, true));
          callbacks.current.onTime(time.current);
          if (
            time.current >= (current.currentItem?.endTime ?? Infinity) &&
            !ended.current
          ) {
            ended.current = true;
            players.forEach((adapter) => adapter?.video.pause());
            callbacks.current.onEnd();
          }
        }
        players.forEach((adapter, index) => {
          if (adapter)
            adapter.video.volume =
              index === 0 && !current.isMuted ? current.volume : 0;
        });
      } catch (cause) {
        players.forEach((adapter) => adapter?.video.pause());
        setError(
          cause instanceof Error
            ? cause.message
            : '映像を再生できませんでした。',
        );
        current.setIsPlaying(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, callbacks, error, loading, resolved, sourceKey]);

  const seek = useCallback(
    (value: number): boolean => {
      if (!active) return false;
      time.current = value;
      ended.current = false;
      try {
        adapters.current.forEach((adapter) =>
          adapter?.sync(value, false, true),
        );
      } catch (cause) {
        adapters.current.forEach((adapter) => adapter?.video.pause());
        setError(
          cause instanceof Error
            ? cause.message
            : '映像を再生できませんでした。',
        );
        latest.current.setIsPlaying(false);
      }
      latest.current.setCurrentTime(value);
      return true;
    },
    [active],
  );
  return {
    active,
    loading: active && (loading || resolved?.key !== sourceKey) && !error,
    error: active ? error : '',
    retry,
    seek,
    resolve: (value, isSecondary) => {
      if (!active) return undefined;
      const timeline =
        resolved?.key === sourceKey
          ? resolved.timelines[isSecondary ? 1 : 0]
          : null;
      return timeline ? resolveMediaTime(timeline, value) : null;
    },
  };
};
