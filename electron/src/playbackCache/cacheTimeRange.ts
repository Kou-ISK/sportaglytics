import { canonicalSeconds } from './cacheRational';
import type { CacheMediaStream } from './cacheMediaMetadata';
type Fraction = readonly [bigint, bigint];
const fraction = (value: string): Fraction => {
  const parts = value.split('/');
  return [BigInt(parts[0]), BigInt(parts[1])];
};
const subtract = (a: Fraction, b: Fraction): Fraction => [
  a[0] * b[1] - b[0] * a[1],
  a[1] * b[1],
];
const compare = (a: Fraction, b: Fraction): bigint => a[0] * b[1] - b[0] * a[1];
const timestamp = (ticks: number, base: string): Fraction =>
  fraction(canonicalSeconds(ticks, base));
export const assertCacheStreamSpan = (
  streams: readonly CacheMediaStream[],
): void => {
  let start: Fraction | null = null;
  let end: Fraction | null = null;
  for (const stream of streams) {
    const a = timestamp(stream.start_pts, stream.time_base);
    const b = timestamp(
      stream.start_pts + stream.duration_ts,
      stream.time_base,
    );
    if (compare(a, b) >= 0) throw Error('CACHE_INVALID_STREAM_RANGE');
    if (!start || compare(a, start) < 0) start = a;
    if (!end || compare(b, end) > 0) end = b;
  }
  if (!start || !end || compare(subtract(end, start), [120n, 1n]) > 0)
    throw Error('CACHE_PROBE_SCOPE_LIMIT');
};
/** AAC priming and padding are removed from presentation bounds, never from
 * packet hashes. Presentation must fit the stream's explicit edit interval. */
export const assertCacheAudioPacketRange = (
  stream: CacheMediaStream,
  pts: number,
  duration: number,
  skip: number,
  padding: number,
): { first: boolean; last: boolean } => {
  const rate = Number(stream.sample_rate);
  if (!Number.isSafeInteger(rate) || rate <= 0)
    throw Error('CACHE_AUDIO_SAMPLE_RATE');
  const a = subtract(timestamp(pts, stream.time_base), [
    -BigInt(skip),
    BigInt(rate),
  ]);
  const b = subtract(timestamp(pts + duration, stream.time_base), [
    BigInt(padding),
    BigInt(rate),
  ]);
  const start = timestamp(stream.start_pts, stream.time_base);
  const end = timestamp(
    stream.start_pts + stream.duration_ts,
    stream.time_base,
  );
  if (compare(a, b) > 0 || compare(a, start) < 0 || compare(b, end) > 0)
    throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
  return { first: compare(a, start) === 0n, last: compare(b, end) === 0n };
};
