import { canonicalSeconds, rational } from './cacheRational';
export { canonicalSeconds, rational } from './cacheRational';
import {
  objectValue,
  stringValue,
  integerValue,
  enumValue,
  arrayValue,
} from '../../../src/shared/validation/jsonValues';
import { assertCacheStreamSpan } from './cacheTimeRange';
import { createHash } from 'node:crypto';

export interface CacheMediaStream {
  index: number;
  codec_type: 'video' | 'audio';
  codec_name: string;
  time_base: string;
  start_pts: number;
  duration_ts: number;
  avg_frame_rate: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  field_order?: string;
  sample_aspect_ratio?: string;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  extradata_hash?: string;
  initial_padding?: number;
  disposition: Record<string, number>;
  tags?: Record<string, string>;
  side_data_list?: unknown[];
}
const parseStream = (value: unknown): CacheMediaStream => {
  const v = objectValue(value);
  const text = (key: string): string | undefined =>
    v[key] === undefined ? undefined : stringValue(v[key]);
  const positive = (key: string): number | undefined =>
    v[key] === undefined ? undefined : integerValue(v[key], 1);
  return {
    index: integerValue(v.index, 0),
    codec_type: enumValue(v.codec_type, ['video', 'audio']),
    codec_name: stringValue(v.codec_name),
    time_base: stringValue(v.time_base),
    start_pts: integerValue(v.start_pts),
    duration_ts: integerValue(v.duration_ts, 1),
    avg_frame_rate: stringValue(v.avg_frame_rate),
    width: positive('width'),
    height: positive('height'),
    pix_fmt: text('pix_fmt'),
    field_order: text('field_order'),
    sample_aspect_ratio: text('sample_aspect_ratio'),
    color_range: text('color_range'),
    color_space: text('color_space'),
    color_transfer: text('color_transfer'),
    color_primaries: text('color_primaries'),
    sample_rate: text('sample_rate'),
    channels: positive('channels'),
    channel_layout: text('channel_layout'),
    extradata_hash: text('extradata_hash'),
    initial_padding:
      v.initial_padding === undefined
        ? undefined
        : integerValue(v.initial_padding, 0),
    disposition: Object.fromEntries(
      Object.entries(objectValue(v.disposition)).map(([k, n]) => [
        k,
        integerValue(n),
      ]),
    ),
    tags:
      v.tags === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(objectValue(v.tags)).map(([k, t]) => [
              k,
              stringValue(t),
            ]),
          ),
    side_data_list:
      v.side_data_list === undefined ? undefined : arrayValue(v.side_data_list),
  };
};
export interface CacheMediaMetadata {
  video: CacheMediaStream;
  audio: CacheMediaStream[];
  interlaced: boolean;
  timeScale: number;
  outputFps: { numerator: number; denominator: number };
  durationSeconds: number;
}
// Initial end-to-end qualification only. Never silently truncate a longer file.
export const CACHE_MAX_DURATION_SECONDS = 120;
export const mediaConfigurationHash = (stream: CacheMediaStream): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        codec: stream.codec_name,
        sampleRate: stream.sample_rate,
        channels: stream.channels,
        layout: stream.channel_layout,
        extradata: stream.extradata_hash,
        start: canonicalSeconds(stream.start_pts, stream.time_base),
        duration: canonicalSeconds(stream.duration_ts, stream.time_base),
        disposition: Object.entries(stream.disposition).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
        initialPadding: stream.initial_padding ?? 0,
        tags: Object.entries(stream.tags ?? {}).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      }),
    )
    .digest('hex');

/** Initial supported path: closed MP4, one SDR 4:2:0 video followed by AAC.
 * Other layouts are rejected before conversion, never flattened. */
export const parseCacheMediaMetadata = (value: unknown): CacheMediaMetadata => {
  const parsed = {
    streams: arrayValue(objectValue(value).streams, 1, 9).map(parseStream),
  };
  const [video, ...audio] = parsed.streams;
  if (
    video.index !== 0 ||
    video.codec_type !== 'video' ||
    !['h264', 'mpeg2video'].includes(video.codec_name) ||
    !video.width ||
    !video.height ||
    video.width > 1920 ||
    video.height > 1080 ||
    video.width % 2 ||
    video.height % 2 ||
    video.pix_fmt !== 'yuv420p' ||
    !['progressive', 'tt', 'bb', 'tb', 'bt'].includes(
      video.field_order ?? '',
    ) ||
    !['1:1', undefined].includes(video.sample_aspect_ratio) ||
    (video.side_data_list?.length ?? 0) !== 0 ||
    !['bt709', undefined].includes(video.color_space) ||
    !['bt709', undefined].includes(video.color_transfer) ||
    !['bt709', undefined].includes(video.color_primaries) ||
    audio.some(
      (stream, index) =>
        stream.index !== index + 1 ||
        stream.codec_type !== 'audio' ||
        stream.codec_name !== 'aac' ||
        !stream.sample_rate ||
        !stream.channels ||
        !stream.channel_layout ||
        !/^SHA256:[a-f0-9]{64}$/i.test(stream.extradata_hash ?? '') ||
        (stream.side_data_list?.length ?? 0) !== 0,
    )
  )
    throw Error('CACHE_UNSUPPORTED_MEDIA');
  const base = rational(video.time_base);
  const fps = rational(video.avg_frame_rate);
  const interlaced = video.field_order !== 'progressive';
  const multiplier = interlaced ? 2 : 1;
  if (
    base.numerator !== 1 ||
    base.denominator > 100000000 ||
    fps.numerator <= 0 ||
    (fps.numerator / fps.denominator) * multiplier > 120 ||
    video.start_pts < 0 ||
    video.duration_ts / base.denominator > CACHE_MAX_DURATION_SECONDS
  )
    throw Error('CACHE_UNSUPPORTED_TIMING');
  assertCacheStreamSpan(parsed.streams);
  return {
    video,
    audio,
    interlaced,
    timeScale: base.denominator * multiplier,
    outputFps: {
      numerator: fps.numerator * multiplier,
      denominator: fps.denominator,
    },
    durationSeconds: video.duration_ts / base.denominator,
  };
};

export const assertCacheVideoMatches = (
  source: CacheMediaMetadata,
  output: CacheMediaMetadata,
): void => {
  const keys = [
    'width',
    'height',
    'pix_fmt',
    'sample_aspect_ratio',
    'color_range',
    'color_space',
    'color_transfer',
    'color_primaries',
  ] as const;
  if (
    output.interlaced ||
    output.video.codec_name !== 'h264' ||
    keys.some((key) => source.video[key] !== output.video[key]) ||
    canonicalSeconds(source.video.start_pts, source.video.time_base) !==
      canonicalSeconds(output.video.start_pts, output.video.time_base) ||
    canonicalSeconds(source.video.duration_ts, source.video.time_base) !==
      canonicalSeconds(output.video.duration_ts, output.video.time_base)
  )
    throw Error('CACHE_VIDEO_CHANGED');
};
