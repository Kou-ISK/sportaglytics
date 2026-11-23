import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { H264_ENCODER_ARGS } from '../mediaTools';
import { runFfmpegProcess } from './exportFfmpegProcess';
import { silentSlideAudio } from './meetingAudioProfile';
import type { MeetingAudioProfile, MeetingAudioTrack } from './meetingAudioProfile';

const silence = (profile: MeetingAudioProfile): string[] => ['-f', 'lavfi', '-i', `anullsrc=r=${profile.rate}:cl=${profile.layout}`];
const encodeAudio = (profile: MeetingAudioProfile): string[] => ['-c:a', 'aac', '-ar', String(profile.rate), '-ac', String(profile.channels), '-channel_layout', profile.layout];
const meetingCodec = [...H264_ENCODER_ARGS,
  ...(H264_ENCODER_ARGS.includes('-pix_fmt') ? [] : ['-pix_fmt', 'yuv420p']), '-r', '30',
  '-video_track_timescale', '90000'];

export const renderMeetingSlide = async (getFfmpegPath: () => string,
  frame: string, seconds: number, target: string, progress?: (fraction: number) => void,
  signal?: AbortSignal, profile: MeetingAudioProfile = silentSlideAudio): Promise<void> => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'sportag-slide-'));
  const png = join(dir, 'frame.png');
  try {
    await fs.writeFile(png, Buffer.from(frame.slice('data:image/png;base64,'.length), 'base64'), { flag: 'wx', mode: 0o600 });
    await runFfmpegProcess(getFfmpegPath, ['-n', '-f', 'image2', '-loop', '1',
      '-framerate', '30', '-c:v', 'png', '-i', png, ...silence(profile), '-map', '0:v:0',
      '-map', '1:a:0', ...meetingCodec, ...encodeAudio(profile), '-t', String(seconds), target],
      progress ? { durationSeconds: seconds, onProgress: progress } : undefined, signal);
  } finally {
    await fs.rm(png, { force: true });
    await fs.rmdir(dir);
  }
};

/** Only mixed meetings need a common canvas and continuous audio across silent slides. */
export const normalizeMeetingClip = async (getFfmpegPath: () => string,
  rendered: string, target: string, audio: MeetingAudioTrack | null, profile: MeetingAudioProfile, seconds: number): Promise<void> => {
  const mayCopy = audio?.codec === 'aac' && audio.rate === profile.rate && audio.layout === profile.layout;
  const audioArgs = mayCopy ? ['-c:a', 'copy'] : ['-af', 'apad', ...encodeAudio(profile)];
  await runFfmpegProcess(getFfmpegPath, ['-n', '-i', rendered, ...(audio ? [] : silence(profile)),
    '-map', '0:v:0', '-map', audio ? '0:a:0' : '1:a:0',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
    ...meetingCodec, ...audioArgs, '-t', String(seconds), target]);
};
