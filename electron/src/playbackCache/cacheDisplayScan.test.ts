import { expect, it } from 'vitest';
import { CacheDisplayScanPrefix } from './cacheDisplayScan';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';
import { CacheTimingAccumulator } from './cacheTimingAccumulator';

const video = {
  index: 0,
  codec_type: 'video',
  codec_name: 'h264',
  time_base: '1/1000',
  start_pts: 55,
  duration_ts: 80,
  width: 320,
  height: 180,
  pix_fmt: 'yuv420p',
  avg_frame_rate: '25/1',
  disposition: {},
};
const frame = {
  pts: 55,
  duration: 40,
  width: 320,
  height: 180,
  pix_fmt: 'yuv420p',
  interlaced_frame: 1,
  top_field_first: 1,
  repeat_pict: 0,
};
it.each([
  [0, 0, 'progressive'],
  [1, 1, 'top-first'],
  [1, 0, 'bottom-first'],
] as const)(
  'classifies display scan without inventing stream field_order: %s/%s',
  (interlaced, top, scan) => {
    const prefix = new CacheDisplayScanPrefix();
    prefix.frame({
      ...frame,
      interlaced_frame: interlaced,
      top_field_first: top,
    });
    const metadata = parseCacheMediaMetadata(
      { streams: [video] },
      prefix.finish(),
    );
    expect(metadata.video.field_order).toBeUndefined();
    expect(metadata.displayScan).toBe(scan);
    expect(metadata.displayScanEvidence).toBe('decoded-prefix');
    const proof = new CacheTimingAccumulator(metadata);
    for (const pts of [55, 95])
      proof.frame({
        ...frame,
        pts,
        interlaced_frame: interlaced,
        top_field_first: top,
      });
    expect(proof.finish().displayFrames).toBe(interlaced ? 4 : 2);
  },
);
it('refuses missing, empty, unknown or contradicted declarations', () => {
  expect(() => parseCacheMediaMetadata({ streams: [video] })).toThrow(
    'CACHE_FIELD_ORDER_UNAVAILABLE',
  );
  for (const order of [null, '', 'unknown', 'future']) {
    expect(() =>
      parseCacheMediaMetadata(
        { streams: [{ ...video, field_order: order }] },
        'top-first',
      ),
    ).toThrow();
  }
  expect(() =>
    parseCacheMediaMetadata(
      { streams: [{ ...video, field_order: 'bb' }] },
      'top-first',
    ),
  ).toThrow('CACHE_UNSUPPORTED_DISPLAY_SCAN');
});
it('rejects empty, over-limit, mixed or incomplete prefix frames', () => {
  expect(() => new CacheDisplayScanPrefix().finish()).toThrow(
    'CACHE_FIELD_ORDER_UNAVAILABLE',
  );
  for (const delta of [
    { top_field_first: 0 },
    { interlaced_frame: 0 },
    { top_field_first: undefined },
    { interlaced_frame: undefined },
    { repeat_pict: 1 },
  ]) {
    const prefix = new CacheDisplayScanPrefix();
    prefix.frame(frame);
    expect(() => prefix.frame({ ...frame, ...delta })).toThrow();
  }
  const prefix = new CacheDisplayScanPrefix();
  for (let i = 0; i < 64; i++) prefix.frame(frame);
  expect(() => prefix.frame(frame)).toThrow('CACHE_UNSUPPORTED_DISPLAY_SCAN');
});
it('a valid prefix never permits a changed or truncated full sequence', () => {
  const metadata = parseCacheMediaMetadata({ streams: [video] }, 'top-first');
  for (const delta of [
    { top_field_first: 0 },
    { interlaced_frame: 0 },
    { repeat_pict: 1 },
    { pts: 96 },
  ]) {
    const proof = new CacheTimingAccumulator(metadata);
    proof.frame(frame);
    expect(() => proof.frame({ ...frame, pts: 95, ...delta })).toThrow();
  }
  const proof = new CacheTimingAccumulator(metadata);
  proof.frame(frame);
  expect(() => proof.finish()).toThrow('CACHE_INCOMPLETE_TIMING');
});
it('validates unsupported formats and stream spans before requesting missing-field classification', () => {
  for (const delta of [
    { duration_ts: 121000 },
    { width: 4000 },
    { avg_frame_rate: '121/1' },
    { color_transfer: 'smpte2084' },
  ]) {
    expect(() =>
      parseCacheMediaMetadata({ streams: [{ ...video, ...delta }] }),
    ).toThrow(/CACHE_UNSUPPORTED_(MEDIA|TIMING)/);
  }
});
