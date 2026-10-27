import { expect, it } from 'vitest';
import { CacheAudioPacketRange } from './cacheTimeRange';
import type { CacheMediaStream } from './cacheMediaMetadata';
const stream: CacheMediaStream = {
  index: 1,
  codec_type: 'audio',
  codec_name: 'aac',
  avg_frame_rate: '0/0',
  time_base: '1/48000',
  start_pts: 0,
  duration_ts: 1440,
  sample_rate: '48000',
  disposition: {},
};
it('carries exact sample priming across packets without treating preroll as presentation', () => {
  const range = new CacheAudioPacketRange(stream);
  expect(range.packet(-2656, 1024, 2656, 0)).toEqual({
    first: false,
    last: false,
  });
  expect(range.packet(-1632, 1024, 0, 0)).toEqual({
    first: false,
    last: false,
  });
  expect(range.packet(-608, 1024, 0, 0)).toEqual({ first: true, last: false });
  expect(range.packet(416, 1024, 0, 0)).toEqual({ first: false, last: true });
  expect(() => range.packet(1440, 1024, 0, 1024)).toThrow();
});
it.each([2655, 2657, 0])(
  'rejects priming that does not land exactly on stream start: %s',
  (skip) => {
    expect(() =>
      new CacheAudioPacketRange(stream).packet(-2656, 1024, skip, 0),
    ).toThrow();
  },
);
it('rejects a second skip declaration and premature padding', () => {
  const range = new CacheAudioPacketRange(stream);
  range.packet(-2656, 1024, 2656, 0);
  expect(() => range.packet(-1632, 1024, 1632, 0)).toThrow();
  expect(() =>
    new CacheAudioPacketRange(stream).packet(0, 1024, 0, 1),
  ).toThrow();
});
it('accepts exact tail padding and rejects over-padding or fractional samples', () => {
  const range = new CacheAudioPacketRange(stream);
  range.packet(0, 1024, 0, 0);
  expect(range.packet(1024, 1024, 0, 608)).toEqual({
    first: false,
    last: true,
  });
  expect(() =>
    new CacheAudioPacketRange(stream).packet(0, 1024, 0, 1025),
  ).toThrow();
  expect(() =>
    new CacheAudioPacketRange({ ...stream, time_base: '1/1001' }).packet(
      0,
      1,
      0,
      0,
    ),
  ).toThrow();
});
