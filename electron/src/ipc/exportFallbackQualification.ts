import { getFfprobePath } from '../mediaTools';
import { runMediaProcess } from './mediaProcessRunner';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown): number =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
const fps = (value: unknown): number => {
  if (typeof value !== 'string' || !/^\d+\/\d+$/.test(value)) return NaN;
  const [n, d] = value.split('/').map(Number);
  return n > 0 && d > 0 ? n / d : NaN;
};
const decode = (raw: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(raw);
  if (!record(value)) throw new Error('Cannot verify fallback video');
  return value;
};
const frameTimes = (value: unknown): number[] => {
  if (!Array.isArray(value) || !value.every(record)) throw new Error('Cannot verify fallback frames');
  return value.map((f) => number(f.best_effort_timestamp_time)).filter(Number.isFinite);
};
const probe = async (file: string, interval: string, signal?: AbortSignal): Promise<Record<string, unknown>> => {
  const result = await runMediaProcess(getFfprobePath(), [
    '-v', 'error', '-select_streams', 'v:0', '-read_intervals', interval,
    '-show_streams', '-show_format', '-show_frames',
    '-show_entries', 'stream=codec_type,avg_frame_rate,start_time,duration:format=start_time,duration:frame=best_effort_timestamp_time',
    '-of', 'json', file,
  ], { timeoutMs: 15000, maxOutputBytes: 65536, signal });
  signal?.throwIfAborted();
  return decode(result.stdout);
};
/** Samples decoded first/last video frames before publication. It does not prove visual identity or full synchronization. */
export const qualifySilentFallback = async (file: string, duration: number, signal?: AbortSignal): Promise<void> => {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid fallback duration');
  const first = await probe(file, '%+#256', signal);
  const streams = first.streams;
  if (!Array.isArray(streams) || streams.length !== 1 || !record(streams[0]) || streams[0].codec_type !== 'video' || !record(first.format)) throw new Error('Fallback video stream missing');
  const rate = fps(streams[0].avg_frame_rate);
  if (!Number.isFinite(rate) || rate < 1 || rate > 240) throw new Error('Fallback frame rate unavailable');
  const frame = 1 / rate;
  const start = number(streams[0].start_time);
  const length = number(streams[0].duration);
  const formatStart = number(first.format.start_time);
  const formatLength = number(first.format.duration);
  const initial = frameTimes(first.frames);
  if (![start, length, formatStart, formatLength].every(Number.isFinite) || Math.abs(start) > frame || Math.abs(formatStart) > frame || Math.abs(length - duration) > frame || Math.abs(formatLength - duration) > frame || !initial.some((pts) => pts >= -frame && pts <= frame)) throw new Error('Fallback video range unavailable');
  const last = await probe(file, `${Math.max(0, duration - frame * 2)}%+#256`, signal);
  const ending = frameTimes(last.frames);
  if (!ending.some((pts) => pts >= duration - frame * 2 && pts < duration + frame)) throw new Error('Fallback end frame unavailable');
};
