import type { NativePlaybackPresentation } from '../../../../types/ipc/nativePlaybackPresentation';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import type { CachePlayerPort } from '../../components/PlaybackCache/cachePlayerSwitch';

export const nativeStartUnavailableReason = (
  presentation: NativePlaybackPresentation,
  time: number,
  settings: ReturnType<CachePlayerPort['settings']>,
  playing: boolean,
): string | null => {
  if (playing) return '一時停止するとネイティブ再生を試せます。';
  if (!presentation.rates.includes(settings.rate))
    return `この試用の再生速度は ${presentation.rates.join(' / ')}× です。`;
  if (
    settings.audio?.length !== presentation.audioTracks ||
    settings.audio.filter(Boolean).length !== 1
  )
    return '音声トラックを1つ選択してください。';
  if (presentation.mutedOnly && !settings.muted)
    return 'この試用は消音にしてから開始してください。';
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
