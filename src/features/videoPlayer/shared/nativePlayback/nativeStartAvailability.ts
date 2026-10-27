import type { NativePlaybackPresentation } from '../../../../types/ipc/nativePlaybackPresentation';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';

export const nativeStartUnavailableReason = (
  presentation: NativePlaybackPresentation,
  time: number,
  settings: ReturnType<CachePlayerPort['settings']>,
  playing: boolean,
): string | null => {
  if (playing)
    return '再生中の映像を中断せず、一時停止後に標準再生を準備します。';
  if (!presentation.rates.includes(settings.rate))
    return `標準再生の対応速度は ${presentation.rates.join(' / ')}× です。現在の速度では互換再生を使用します。`;
  if (
    settings.audio?.length !== presentation.audioTracks ||
    settings.audio.filter(Boolean).length !== 1
  )
    return '音声トラックを1つ選択してください。';
  if (presentation.mutedOnly && !settings.muted)
    return 'この環境では音声再生に互換再生を使用します。';
  const audioTrack = settings.audio.indexOf(true);
  return nativePresentationSupports(
    presentation,
    {
      targetTime: time,
      rate: settings.rate,
      volume: settings.volume,
      muted: settings.muted,
      audioTrack,
    },
    audioTrack,
  )
    ? null
    : '現在の再生位置・音量では原本プレイヤーを使用します。';
};
