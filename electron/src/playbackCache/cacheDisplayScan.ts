import {
  integerValue,
  objectValue,
} from '../../../src/shared/validation/jsonValues';

/** Display order only; decoded frames cannot prove encoded field order. */
export type CacheDisplayScan = 'progressive' | 'top-first' | 'bottom-first';

export const declaredCacheDisplayScan = (
  fieldOrder: string | undefined,
): CacheDisplayScan | undefined => {
  if (fieldOrder === undefined) return undefined;
  if (fieldOrder === 'progressive') return 'progressive';
  if (fieldOrder === 'tt' || fieldOrder === 'bt') return 'top-first';
  if (fieldOrder === 'bb' || fieldOrder === 'tb') return 'bottom-first';
  throw Error('CACHE_UNSUPPORTED_MEDIA');
};

/** A bounded preliminary classification, never a full-file timing proof.
 * The timing accumulator must subsequently verify every decoded frame. */
export class CacheDisplayScanPrefix {
  private count = 0;
  private scan: CacheDisplayScan | undefined;

  frame(value: unknown): void {
    const frame = objectValue(value);
    const interlaced = integerValue(frame.interlaced_frame, 0, 1);
    const top = integerValue(frame.top_field_first, 0, 1);
    integerValue(frame.repeat_pict, 0, 0);
    const scan = !interlaced
      ? 'progressive'
      : top
        ? 'top-first'
        : 'bottom-first';
    if (++this.count > 64 || (this.scan && this.scan !== scan))
      throw Error('CACHE_UNSUPPORTED_DISPLAY_SCAN');
    this.scan = scan;
  }

  finish(): CacheDisplayScan {
    if (!this.scan) throw Error('CACHE_FIELD_ORDER_UNAVAILABLE');
    return this.scan;
  }
}
