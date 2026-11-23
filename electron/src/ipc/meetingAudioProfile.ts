import { getFfprobePath } from '../mediaTools';
import { exportAbortContext } from './exportAbortContext';
import { runMediaProcess } from './mediaProcessRunner';

export interface MeetingAudioProfile {
  readonly rate: number;
  readonly channels: number;
  readonly layout: string;
}

export interface MeetingAudioTrack extends MeetingAudioProfile {
  readonly codec: string;
}

export const silentSlideAudio: MeetingAudioProfile = { rate: 48000, channels: 2, layout: 'stereo' };

export const readMeetingAudio = async (rendered: string): Promise<MeetingAudioTrack | null> => {
  const { stdout } = await runMediaProcess(getFfprobePath(), [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels,channel_layout', '-of', 'json', rendered,
  ], { timeoutMs: 15000, maxOutputBytes: 65536, signal: exportAbortContext.getStore() });
  const result: unknown = JSON.parse(stdout);
  if (!result || typeof result !== 'object' || !('streams' in result) || !Array.isArray(result.streams))
    throw new Error('映像の音声構成を確認できませんでした。');
  if (!result.streams.length) return null;
  const stream: unknown = result.streams[0];
  if (!stream || typeof stream !== 'object' || !('channels' in stream) || !('sample_rate' in stream) || !('codec_name' in stream))
    throw new Error('映像の音声構成を確認できませんでした。');
  const channels = Number(stream.channels);
  const rate = Number(stream.sample_rate);
  const layout = 'channel_layout' in stream && typeof stream.channel_layout === 'string' && stream.channel_layout !== 'unknown'
    ? stream.channel_layout : channels === 1 ? 'mono' : channels === 2 ? 'stereo' : '';
  if (!layout || !/^[a-zA-Z0-9.()+_-]{1,40}$/.test(layout) || !Number.isInteger(channels) || channels < 1 ||
      channels > 8 || !Number.isInteger(rate) || rate < 7350 || rate > 96000 || typeof stream.codec_name !== 'string')
    throw new Error('スライドとの結合に対応していない音声構成です。');
  return { channels, rate, layout, codec: stream.codec_name };
};

export const meetingAudioProfile = (tracks: readonly (MeetingAudioTrack | null)[]): MeetingAudioProfile => {
  const audible = tracks.filter((track) => track !== null);
  if (!audible.length) return silentSlideAudio;
  const widest = audible.reduce((previous, current) => current.channels > previous.channels ? current : previous);
  if (audible.some((track) => track.channels === widest.channels && track.layout !== widest.layout))
    throw new Error('音声チャンネルの配置が異なるため、スライドと結合できません。');
  return { channels: widest.channels, layout: widest.layout, rate: Math.max(...audible.map((track) => track.rate)) };
};
