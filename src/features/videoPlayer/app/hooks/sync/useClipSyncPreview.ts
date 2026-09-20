import { useCallback, useEffect, useState } from 'react';
import { useVideoJsPlayer } from '../../../components/Player/SingleVideo/hooks/useVideoJsPlayer';

export type ClipSyncPreview = ReturnType<typeof useVideoJsPlayer> & {
  id: string;
  source: string;
  time: number;
  playing: boolean;
  error: string;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
};

/** A source-local clock. This player never writes to the package playback clock. */
export const useClipSyncPreview = (
  id: string,
  source: string,
  onDuration: (duration: number) => void,
): ClipSyncPreview => {
  const media = useVideoJsPlayer({
    id,
    videoSrc: source,
    allowSeek: false,
    setMaxSec: onDuration,
  });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const { playerRef } = media;
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setError('');
    const player = playerRef.current;
    if (!player) return;
    const update = (): void => {
      setTime(player.currentTime() ?? 0);
      setPlaying(!player.paused() && !player.ended());
    };
    const fail = (): void =>
      setError('映像を読み込めません。元ファイルの接続を確認してください。');
    const events = ['timeupdate', 'seeked', 'play', 'pause', 'ended'];
    events.forEach((event) => player.on(event, update));
    player.on('error', fail);
    return () => {
      if (player.isDisposed()) return;
      events.forEach((event) => player.off(event, update));
      player.off('error', fail);
    };
  }, [source, playerRef]);

  const seek = useCallback(
    (value: number): void => {
      const player = playerRef.current;
      if (!player || player.isDisposed() || !Number.isFinite(value)) return;
      const duration = player.duration() ?? 0;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const next = Math.max(0, Math.min(value, duration));
      player.currentTime(next);
      setTime(next);
    },
    [playerRef],
  );
  const pause = useCallback((): void => {
    playerRef.current?.pause();
  }, [playerRef]);
  const play = useCallback((): void => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    void player
      .play()
      ?.catch(() =>
        setError('再生を開始できません。映像を確認して再試行してください。'),
      );
  }, [playerRef]);
  return { ...media, id, source, time, playing, error, seek, play, pause };
};
