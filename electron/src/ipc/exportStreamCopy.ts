import { getFfprobePath } from '../mediaTools';
import { runMediaProcess } from './mediaProcessRunner';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const signatureFields = [
  'codec_type',
  'codec_name',
  'codec_tag_string',
  'profile',
  'level',
  'width',
  'height',
  'pix_fmt',
  'sample_aspect_ratio',
  'field_order',
  'color_range',
  'color_space',
  'color_transfer',
  'color_primaries',
  'time_base',
  'extradata_hash',
  'side_data_list',
  'sample_fmt',
  'sample_rate',
  'channels',
  'channel_layout',
] as const;

interface StreamCopyMetadata {
  duration: number;
  signature: string;
  hasAudio: boolean;
  hasBFrames: boolean;
}

export const readStreamCopyMetadata = async (
  file: string,
): Promise<StreamCopyMetadata | null> => {
  try {
    const result = await runMediaProcess(
      getFfprobePath(),
      [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-show_data_hash',
        'sha256',
        '-of',
        'json',
        file,
      ],
      { timeoutMs: 30000, maxOutputBytes: 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(result.stdout);
    if (
      !isRecord(parsed) ||
      !isRecord(parsed.format) ||
      typeof parsed.format.duration !== 'string' ||
      (parsed.format.start_time !== undefined &&
        typeof parsed.format.start_time !== 'string') ||
      !Array.isArray(parsed.streams) ||
      !parsed.streams.every(isRecord)
    )
      return null;
    const { streams, format } = parsed;
    const video = streams.filter((stream) => stream.codec_type === 'video');
    const audio = streams.filter((stream) => stream.codec_type === 'audio');
    const duration = Number(format.duration);
    if (
      video.length !== 1 ||
      audio.length > 1 ||
      streams.length !== video.length + audio.length ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(Number(format.start_time ?? 0)) ||
      Math.abs(Number(format.start_time ?? 0)) > 0.001 ||
      !['h264', 'hevc'].includes(String(video[0].codec_name)) ||
      typeof video[0].width !== 'number' ||
      typeof video[0].height !== 'number' ||
      typeof video[0].time_base !== 'string' ||
      typeof video[0].extradata_hash !== 'string' ||
      audio.some(
        (stream) => !['aac', 'mp3', 'alac'].includes(String(stream.codec_name)),
      )
    )
      return null;
    return {
      duration,
      signature: JSON.stringify(
        streams.map((stream) =>
          signatureFields.map((field) => stream[field] ?? null),
        ),
      ),
      hasAudio: audio.length > 0,
      hasBFrames: video[0].has_b_frames !== 0,
    };
  } catch {
    // A copy optimization must never bypass the normal encoder when compatibility is unknown.
    return null;
  }
};

export const canConcatenateWithoutEncoding = async (
  files: string[],
): Promise<boolean> => {
  if (!files.length) return false;
  const metadata = await Promise.all(files.map(readStreamCopyMetadata));
  const first = metadata[0];
  return (
    first !== null &&
    metadata.every((item) => item?.signature === first.signature)
  );
};

const isKeyframeAt = async (file: string, time: number): Promise<boolean> => {
  if (time === 0) return true;
  const result = await runMediaProcess(
    getFfprobePath(),
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-skip_frame',
      'nokey',
      '-read_intervals',
      `${time}%+2`,
      '-show_frames',
      '-show_entries',
      'frame=best_effort_timestamp_time,key_frame',
      '-of',
      'json',
      file,
    ],
    { timeoutMs: 30000, maxOutputBytes: 256 * 1024 },
  );
  const data: unknown = JSON.parse(result.stdout);
  if (!isRecord(data) || !Array.isArray(data.frames)) return false;
  const frames: unknown[] = data.frames;
  return (
    frames.every(
      (frame) =>
        isRecord(frame) &&
        typeof frame.key_frame === 'number' &&
        (frame.best_effort_timestamp_time === undefined ||
          typeof frame.best_effort_timestamp_time === 'string'),
    ) &&
    frames.some(
      (frame) =>
        isRecord(frame) &&
        frame.key_frame === 1 &&
        Math.abs(Number(frame.best_effort_timestamp_time) - time) < 0.0001,
    )
  );
};

export const resolveMediaCopyMode = async (
  file: string,
  start: number,
  duration: number,
): Promise<'whole-file' | 'keyframe-range' | null> => {
  const metadata = await readStreamCopyMetadata(file);
  if (
    !metadata ||
    !Number.isFinite(start) ||
    !Number.isFinite(duration) ||
    start < 0 ||
    duration <= 0
  )
    return null;
  const atEnd = Math.abs(start + duration - metadata.duration) < 0.001;
  if (start === 0 && atEnd) return 'whole-file';
  // Partial inter-frame/B-frame and audio packet cuts can shift the selected interval.
  // Use accurate input seeking + encoding unless both boundaries are provably safe.
  if (
    metadata.hasAudio ||
    metadata.hasBFrames ||
    start + duration > metadata.duration
  )
    return null;
  try {
    return (await isKeyframeAt(file, start)) &&
      (atEnd || (await isKeyframeAt(file, start + duration)))
      ? 'keyframe-range'
      : null;
  } catch {
    return null;
  }
};
