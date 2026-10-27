/** Retains every owned cleanup failure without implying that resources closed. */
export class CacheRangeFailure extends Error {
  readonly failures: readonly unknown[];
  constructor(code: string, failures: readonly unknown[]) {
    super(code);
    this.name = 'CacheRangeFailure';
    this.failures = Object.freeze([...failures]);
  }
}
