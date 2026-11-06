import { getFfprobePath } from '../mediaTools';
import { runMediaProcess } from '../ipc/mediaProcessRunner';

interface Stream {
  codec_type?: unknown;
  start_time?: unknown;
  duration?: unknown;
  avg_frame_rate?: unknown;
}
// FFmpeg parses the requested seek/duration in AV_TIME_BASE microseconds.
// Integer comparison avoids binary floating-point errors at exact boundaries.
const microseconds = (value: number): number => {
  const result = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(result))
    throw Error('PLAYLIST_CLIP_SOURCE_AUDIO_TIME_UNKNOWN');
  return result;
};
const probe = async (
  file: string,
): Promise<{ streams: Stream[]; formatStart: number | null }> => {
  const result = await runMediaProcess(
    getFfprobePath(),
    [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,start_time,duration,avg_frame_rate:format=start_time',
      '-of',
      'json',
      file,
    ],
    { timeoutMs: 30000, maxOutputBytes: 1024 * 1024 },
  );
  const value: unknown = JSON.parse(result.stdout);
  if (
    !value ||
    typeof value !== 'object' ||
    !('streams' in value) ||
    !Array.isArray(value.streams) ||
    !value.streams.every(
      (stream: unknown) =>
        !!stream && typeof stream === 'object' && !Array.isArray(stream),
    )
  )
    throw Error('PLAYLIST_CLIP_PROBE_INVALID');
  const format =
    'format' in value &&
    value.format &&
    typeof value.format === 'object' &&
    !Array.isArray(value.format)
      ? value.format
      : null;
  const start =
    format && 'start_time' in format && typeof format.start_time === 'string'
      ? Number(format.start_time)
      : NaN;
  return {
    streams: value.streams,
    formatStart: Number.isFinite(start) ? start : null,
  };
};
/** Select only known tracks overlapping the requested half-open interval.
 * Unknown timing is rejected instead of silently losing a track. */
export const overlappingEmbeddedAudio = async (
  source: string,
  sourceStart: number,
  duration: number,
): Promise<number[]> => {
  const before = await probe(source);
  const sourceAudio = before.streams.filter((s) => s.codec_type === 'audio');
  if (sourceAudio.length && before.formatStart === null)
    throw Error('PLAYLIST_CLIP_SOURCE_AUDIO_TIME_UNKNOWN');
  const intervalStart =
    microseconds(sourceStart) + microseconds(before.formatStart ?? 0);
  const intervalEnd = intervalStart + microseconds(duration);
  if (
    !Number.isSafeInteger(intervalStart) ||
    !Number.isSafeInteger(intervalEnd)
  )
    throw Error('PLAYLIST_CLIP_SOURCE_AUDIO_TIME_UNKNOWN');
  return sourceAudio.flatMap((stream, index) => {
    const start = Number(stream.start_time);
    const length = Number(stream.duration);
    if (
      typeof stream.start_time !== 'string' ||
      typeof stream.duration !== 'string' ||
      !Number.isFinite(start) ||
      !Number.isFinite(length) ||
      length < 0
    )
      throw Error('PLAYLIST_CLIP_SOURCE_AUDIO_TIME_UNKNOWN');
    const startUs = microseconds(start);
    const lengthUs = microseconds(length);
    const endUs = startUs + lengthUs;
    if (!Number.isSafeInteger(endUs))
      throw Error('PLAYLIST_CLIP_SOURCE_AUDIO_TIME_UNKNOWN');
    return lengthUs > 0 && startUs < intervalEnd && endUs > intervalStart
      ? [index]
      : [];
  });
};

/** Fail closed if the produced file does not have the requested tracks and interval. */
export const validateEmbeddedOutput = async (
  source: string,
  output: string,
  duration: number,
  selectedAudio: boolean,
  sourceStart = 0,
): Promise<void> => {
  const overlappingAudio = await overlappingEmbeddedAudio(
    source,
    sourceStart,
    duration,
  );
  const after = await probe(output);
  const videos = after.streams.filter((s) => s.codec_type === 'video');
  const audio = after.streams.filter((s) => s.codec_type === 'audio');
  if (
    videos.length !== 1 ||
    audio.length !== (selectedAudio ? 1 : overlappingAudio.length)
  )
    throw Error('PLAYLIST_CLIP_TRACK_MISMATCH');
  const rate =
    typeof videos[0].avg_frame_rate === 'string'
      ? videos[0].avg_frame_rate.match(/^(\d+)\/(\d+)$/)
      : null;
  const fps = rate ? Number(rate[1]) / Number(rate[2]) : NaN;
  if (!Number.isFinite(fps) || fps <= 0)
    throw Error('PLAYLIST_CLIP_FPS_INVALID');
  const tolerance = Math.max(0.1, 2 / fps);
  for (const stream of videos) {
    const start = Number(stream.start_time);
    const length = Number(stream.duration);
    if (
      typeof stream.start_time !== 'string' ||
      typeof stream.duration !== 'string' ||
      !Number.isFinite(start) ||
      !Number.isFinite(length) ||
      Math.abs(start) > tolerance ||
      Math.abs(length - duration) > tolerance
    )
      throw Error('PLAYLIST_CLIP_TIME_MISMATCH');
  }
  for (const stream of audio) {
    const start = Number(stream.start_time);
    const length = Number(stream.duration);
    if (
      typeof stream.start_time !== 'string' ||
      typeof stream.duration !== 'string' ||
      !Number.isFinite(start) ||
      !Number.isFinite(length) ||
      start < -tolerance ||
      length <= 0 ||
      start + length > duration + tolerance
    )
      throw Error('PLAYLIST_CLIP_AUDIO_TIME_INVALID');
  }
};
