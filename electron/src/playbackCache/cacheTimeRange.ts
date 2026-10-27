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
/** AAC leading skip can span several consecutive packets. Only the initial
 * edit is supported; every packet and its original side data remain hashed. */
export class CacheAudioPacketRange {
  private initial = true;
  private skipRemaining = 0n;
  private ended = false;
  constructor(private readonly stream: CacheMediaStream) {}

  packet(
    pts: number,
    duration: number,
    skip: number,
    padding: number,
  ): { first: boolean; last: boolean } {
    const stream = this.stream;
    const rate = Number(stream.sample_rate);
    if (!Number.isSafeInteger(rate) || rate <= 0)
      throw Error('CACHE_AUDIO_SAMPLE_RATE');
    const rawStart = timestamp(pts, stream.time_base);
    const rawEnd = timestamp(pts + duration, stream.time_base);
    const start = timestamp(stream.start_pts, stream.time_base);
    const end = timestamp(
      stream.start_pts + stream.duration_ts,
      stream.time_base,
    );
    const span = subtract(rawEnd, rawStart);
    const samplesNumerator = span[0] * BigInt(rate);
    if (samplesNumerator % span[1] !== 0n || this.ended)
      throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
    const samples = samplesNumerator / span[1];
    if (this.initial) {
      const firstPresented = subtract(rawStart, [-BigInt(skip), BigInt(rate)]);
      if (compare(firstPresented, start) !== 0n)
        throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
      this.skipRemaining = BigInt(skip);
      this.initial = false;
    } else if (skip !== 0) {
      throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
    }
    const consumed =
      this.skipRemaining < samples ? this.skipRemaining : samples;
    this.skipRemaining -= consumed;
    if (BigInt(padding) > samples - consumed)
      throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
    const a = subtract(rawStart, [-consumed, BigInt(rate)]);
    const b = subtract(rawEnd, [BigInt(padding), BigInt(rate)]);
    if (consumed === samples) {
      // Entire priming packet is decoded but has no presented samples.
      if (padding || compare(b, start) > 0n)
        throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
      return { first: false, last: false };
    }
    if (
      compare(a, b) > 0n ||
      compare(a, start) < 0n ||
      compare(b, end) > 0n ||
      (padding > 0 && compare(b, end) !== 0n)
    )
      throw Error('CACHE_AUDIO_PRESENTATION_RANGE');
    this.ended = compare(b, end) === 0n;
    return { first: compare(a, start) === 0n, last: this.ended };
  }
}
