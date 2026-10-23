import { expect, it } from 'vitest';
import { ProbeJsonSequence } from './probeJsonSequence';
import { CacheTimingAccumulator } from './cacheTimingAccumulator';
import {
  parseCacheMediaMetadata,
  canonicalSeconds,
  assertCacheVideoMatches,
} from './cacheMediaMetadata';
import { buildCacheRecipe } from './cacheRecipe';

const video = {
  index: 0,
  codec_type: 'video',
  codec_name: 'h264',
  time_base: '1/1000',
  start_pts: 5000,
  duration_ts: 80,
  width: 320,
  height: 180,
  pix_fmt: 'yuv420p',
  field_order: 'tt',
  avg_frame_rate: '25/1',
  sample_aspect_ratio: '1:1',
  disposition: {},
  color_space: 'bt709',
  color_transfer: 'bt709',
  color_primaries: 'bt709',
};
const audio = (index: number) => ({
  index,
  codec_type: 'audio',
  codec_name: 'aac',
  time_base: '1/48000',
  start_pts: 240000,
  duration_ts: 2048,
  avg_frame_rate: '0/0',
  sample_rate: '48000',
  channels: 2,
  channel_layout: 'stereo',
  extradata_hash: 'SHA256:' + 'a'.repeat(64),
  disposition: { default: index === 1 ? 1 : 0 },
  tags: { language: 'und' },
});
const frame = (pts: number, duration: number, interlaced = 1) => ({
  pts,
  duration,
  width: 320,
  height: 180,
  pix_fmt: 'yuv420p',
  interlaced_frame: interlaced,
  top_field_first: interlaced,
  repeat_pict: 0,
});
const packet = (index: number, pts: number) => ({
  stream_index: index,
  pts,
  dts: pts,
  duration: 1024,
  size: '32',
  data_hash: 'SHA256:' + String(index).repeat(64),
});
const input = () =>
  parseCacheMediaMetadata({ streams: [video, audio(1), audio(2), audio(3)] });
const output = () =>
  parseCacheMediaMetadata({
    streams: [
      {
        ...video,
        time_base: '1/2000',
        start_pts: 10000,
        duration_ts: 160,
        field_order: 'progressive',
        avg_frame_rate: '50/1',
      },
      audio(1),
      audio(2),
      audio(3),
    ],
  });
const addAudio = (proof: CacheTimingAccumulator): void => {
  for (const index of [1, 2, 3]) {
    proof.packet(packet(index, 240000));
    proof.packet(packet(index, 241024));
  }
};
it('streams split JSON records with quoted braces, escapes and nested side data', () => {
  const records: unknown[] = [];
  const reader = new ProbeJsonSequence('packets', (value) =>
    records.push(value),
  );
  const values = [
    { text: '"\\{日本}', side_data_list: [{ skip_samples: 1024 }] },
    { pts: 1 },
  ];
  for (const character of JSON.stringify({ packets: values }))
    reader.write(character);
  expect(reader.finish()).toBe(2);
  expect(records).toEqual(values);
});
it.each(['{"frames":[{"pts":1}', '{"frames":[{},]}', '{"frames":[]}{}'])(
  'rejects a malformed or incomplete sequence: %s',
  (text) => {
    const reader = new ProbeJsonSequence('frames', () => undefined);
    expect(() => {
      reader.write(text);
      reader.finish();
    }).toThrow();
  },
);
it('rejects oversized records and unknown root sections', () => {
  expect(() =>
    new ProbeJsonSequence('frames', () => undefined, 8).write(
      '{"frames":[{"text":"long"}]}',
    ),
  ).toThrow();
  expect(() =>
    new ProbeJsonSequence('frames', () => undefined).write('x'.repeat(129)),
  ).toThrow();
});
it('matches all nonzero-PTS fields and every audio packet without time rounding', () => {
  const before = new CacheTimingAccumulator(input());
  const after = new CacheTimingAccumulator(output());
  before.frame(frame(5000, 40));
  before.frame(frame(5040, 40));
  for (const pts of [10000, 10040, 10080, 10120])
    after.frame(frame(pts, 40, 0));
  addAudio(before);
  addAudio(after);
  expect(before.finish()).toEqual(after.finish());
  assertCacheVideoMatches(input(), output());
  expect(canonicalSeconds(1001, '1/60000', 2)).toBe('1001/120000');
});
it('rejects missing or ambiguous fields, VFR interlaced duration and incomplete audio', () => {
  const proof = new CacheTimingAccumulator(input());
  proof.frame(frame(5000, 40));
  expect(() => proof.frame(frame(5040, 30))).toThrow();
  expect(() => proof.frame(frame(5080, 40))).toThrow();
  expect(() =>
    proof.frame({ ...frame(5040, 40), top_field_first: 0 }),
  ).toThrow();
  proof.frame(frame(5040, 40));
  expect(() => proof.finish()).toThrow('CACHE_INCOMPLETE_TIMING');
});
it.each(['payload', 'pts', 'padding', 'language', 'title', 'initial_padding'])(
  'detects individual audio %s changes with the same packet count',
  (change) => {
    const baseline = new CacheTimingAccumulator(input());
    const altered = input();
    if (change === 'language') altered.audio[0].tags = { language: 'jpn' };
    if (change === 'title')
      altered.audio[0].tags = { language: 'und', title: 'Second' };
    if (change === 'initial_padding') altered.audio[0].initial_padding = 1;
    const changed = new CacheTimingAccumulator(altered);
    for (const proof of [baseline, changed]) {
      proof.frame(frame(5000, 40));
      proof.frame(frame(5040, 40));
      for (const index of [1, 2, 3])
        for (const pts of [240000, 241024]) {
          const value = packet(index, pts);
          const mutating = proof === changed && index === 1 && pts === 240000;
          if (mutating && change === 'pts') {
            expect(() => proof.packet({ ...value, pts: pts + 1 })).toThrow();
            return;
          }
          if (mutating && change === 'padding') {
            proof.packet({
              ...value,
              side_data_list: [
                {
                  side_data_type: 'Skip Samples',
                  skip_samples: 0,
                  discard_padding: 0,
                  skip_reason: 1,
                  discard_reason: 0,
                },
              ],
            });
          } else
            proof.packet(
              mutating && change === 'payload'
                ? { ...value, data_hash: 'SHA256:' + 'f'.repeat(64) }
                : value,
            );
        }
    }
    expect(baseline.finish()).not.toEqual(changed.finish());
  },
);
it.each([
  ['tb', 0],
  ['bt', 1],
] as const)('uses displayed field order for %s', (order, top) => {
  const metadata = input();
  metadata.video.field_order = order;
  const proof = new CacheTimingAccumulator(metadata);
  expect(() =>
    proof.frame({ ...frame(5000, 40), top_field_first: top }),
  ).not.toThrow();
});
it('bounds all stream presentation times, including long or distant audio', () => {
  for (const delta of [
    { duration_ts: 123 * 48000 },
    { start_pts: 1000 * 48000 },
  ]) {
    expect(() =>
      parseCacheMediaMetadata({ streams: [video, { ...audio(1), ...delta }] }),
    ).toThrow();
  }
  const proof = new CacheTimingAccumulator(input());
  expect(() => proof.packet(packet(1, 0))).toThrow(
    'CACHE_AUDIO_PRESENTATION_RANGE',
  );
});
it('fails closed on long, unknown field order, HDR and unsupported audio', () => {
  for (const change of [
    { duration_ts: 121000 },
    { field_order: 'unknown' },
    { color_transfer: 'smpte2084' },
  ]) {
    expect(() =>
      parseCacheMediaMetadata({ streams: [{ ...video, ...change }] }),
    ).toThrow();
  }
  expect(() =>
    parseCacheMediaMetadata({
      streams: [video, { ...audio(1), codec_name: 'pcm_s16le' }],
    }),
  ).toThrow();
});
it('fixes the bundled hardware recipe without truncation, fps coercion or audio encoding', () => {
  const args = buildCacheRecipe(
    '/package/source.mp4',
    '/private/media.mp4',
    input(),
    'darwin',
  );
  expect(args).toContain('h264_videotoolbox');
  expect(args[args.indexOf('-allow_sw') + 1]).toBe('0');
  expect(args[args.indexOf('-c:a') + 1]).toBe('copy');
  expect(args[args.indexOf('-enc_time_base:v') + 1]).toBe('1:2000');
  for (const forbidden of ['-ss', '-t', '-r', '-y', 'libx264'])
    expect(args).not.toContain(forbidden);
  expect(args.filter((item) => item === '-map')).toHaveLength(4);
  expect(() =>
    buildCacheRecipe('/same.mp4', '/same.mp4', input(), 'darwin'),
  ).toThrow();
  expect(() =>
    buildCacheRecipe('/a.mp4', '/b.mp4', input(), 'win32'),
  ).toThrow();
});

it('preserves multi-packet priming and hashes fully skipped packets on all tracks', () => {
  const make = (
    mutate = false,
  ): ReturnType<CacheTimingAccumulator['finish']> => {
    const metadata = input();
    for (const stream of metadata.audio) {
      stream.start_pts = 0;
      stream.duration_ts = 1440;
    }
    metadata.video.start_pts = 0;
    const proof = new CacheTimingAccumulator(metadata);
    proof.frame(frame(0, 40));
    proof.frame(frame(40, 40));
    for (const index of [1, 2, 3]) {
      for (const pts of [-2656, -1632, -608, 416]) {
        const value = packet(index, pts);
        if (mutate && index === 2 && pts === -1632)
          value.data_hash = 'SHA256:' + 'f'.repeat(64);
        proof.packet(
          pts === -2656
            ? {
                ...value,
                side_data_list: [
                  {
                    side_data_type: 'Skip Samples',
                    skip_samples: 2656,
                    discard_padding: 0,
                    skip_reason: 0,
                    discard_reason: 0,
                  },
                ],
              }
            : value,
        );
      }
    }
    return proof.finish();
  };
  const expected = make();
  expect(expected.audio.map((track) => track.packets)).toEqual([4, 4, 4]);
  expect(make()).toEqual(expected);
  expect(make(true)).not.toEqual(expected);
});
