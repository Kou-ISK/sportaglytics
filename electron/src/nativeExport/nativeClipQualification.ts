import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFfprobePath } from '../mediaTools';
import type { NativeClipExportRequest } from './nativeClipExport';

const execute = promisify(execFile);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
interface Metadata {
  format: Record<string, unknown>;
  streams: Record<string, unknown>[];
}
const metadata = (value: unknown): Metadata | null => {
  if (
    !record(value) ||
    !record(value.format) ||
    !Array.isArray(value.streams) ||
    !value.streams.every(record)
  )
    return null;
  return { format: value.format, streams: value.streams };
};
const number = (value: unknown): number =>
  typeof value === 'number' ||
  (typeof value === 'string' && value.trim() !== '')
    ? Number(value)
    : NaN;
const timeBase = (value: unknown): number => {
  if (typeof value !== 'string' || !/^\d+\/\d+$/.test(value)) return NaN;
  const [numerator, denominator] = value.split('/').map(Number);
  return numerator > 0 && denominator > 0 ? numerator / denominator : NaN;
};
const durationMatches = (
  stream: Record<string, unknown>,
  duration: number,
): boolean => {
  const tick = timeBase(stream.time_base);
  return (
    Number.isFinite(tick) &&
    tick <= 0.001 &&
    Math.abs(number(stream.start_time)) <= tick &&
    Math.abs(number(stream.duration) - duration) <= tick
  );
};
const configurationMatches = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: string[],
): boolean =>
  typeof a.extradata_hash === 'string' &&
  /^SHA256:[a-f0-9]{64}$/.test(a.extradata_hash) &&
  a.extradata_hash === b.extradata_hash &&
  fields.every((key) => a[key] !== undefined && a[key] === b[key]);
const transform = (stream: Record<string, unknown>): string | null => {
  if (stream.side_data_list === undefined) return 'identity';
  if (
    !Array.isArray(stream.side_data_list) ||
    !stream.side_data_list.every(record)
  )
    return null;
  const matrices = stream.side_data_list.filter(
    (item) => item.side_data_type === 'Display Matrix',
  );
  if (!matrices.length) return 'identity';
  if (matrices.length !== 1 || typeof matrices[0].displaymatrix !== 'string')
    return null;
  // Compare all matrix components, including translation/scale, not rotation alone.
  const rows = matrices[0].displaymatrix
    .trim()
    .split('\n')
    .map((line) => line.split(':')[1]?.trim());
  if (
    rows.length !== 3 ||
    rows.some((row) => !row || !/^-?\d+\s+-?\d+\s+-?\d+$/.test(row))
  )
    return null;
  return rows.join(' ').split(/\s+/).map(Number).join(',');
};

/** Independent header/track admission after Apple's exact-range export. This
 * checks presentation ranges, not raw AAC padding or hidden decode preroll. */
export const isQualifiedNativeClip = (
  sourceValue: unknown,
  outputValue: unknown,
  request: NativeClipExportRequest,
): boolean => {
  const source = metadata(sourceValue),
    output = metadata(outputValue);
  if (!source || !output || output.streams.length !== 2) return false;
  const videos = source.streams.filter((s) => s.codec_type === 'video');
  const audios = source.streams.filter((s) => s.codec_type === 'audio');
  const v = output.streams.find((s) => s.codec_type === 'video');
  const a = output.streams.find((s) => s.codec_type === 'audio');
  const audio = audios[request.audioTrack];
  if (
    videos.length !== 1 ||
    !v ||
    !a ||
    !audio ||
    videos[0].codec_name !== 'h264' ||
    audio.codec_name !== 'aac'
  )
    return false;
  if (
    !configurationMatches(videos[0], v, [
      'codec_name',
      'width',
      'height',
      'pix_fmt',
      'sample_aspect_ratio',
    ]) ||
    !configurationMatches(audio, a, [
      'codec_name',
      'sample_rate',
      'channels',
      'channel_layout',
    ])
  )
    return false;
  const sourceTransform = transform(videos[0]);
  if (sourceTransform === null || sourceTransform !== transform(v))
    return false;
  for (const key of [
    'color_range',
    'color_space',
    'color_transfer',
    'color_primaries',
  ]) {
    if (videos[0][key] !== v[key]) return false;
  }
  return (
    durationMatches(v, request.duration) &&
    durationMatches(a, request.duration) &&
    Math.abs(number(output.format.start_time)) <= 0.001 &&
    Math.abs(number(output.format.duration) - request.duration) <= 0.001
  );
};

const probe = async (file: string): Promise<unknown> => {
  // execFile settles after child close, including timeout, before staging cleanup.
  const result = await execute(
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
    {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  return JSON.parse(result.stdout);
};
export const qualifyNativeClip = async (
  candidate: string,
  request: NativeClipExportRequest,
): Promise<boolean> => {
  const source = await probe(request.sourcePath);
  const output = await probe(candidate);
  return isQualifiedNativeClip(source, output, request);
};
