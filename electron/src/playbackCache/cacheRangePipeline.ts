import { CacheRangeFailure } from './cacheRangeFailure';
export interface CacheRangeWork {
  id: number;
  /** Reservation includes staging and delivery copies, not only encoded bytes. */
  maximumBytes: number;
}
export interface CacheRangePipelinePort<T extends object> {
  /** Resolves only after producer close; rejects only after owned failure
   * cleanup. Uncertain close must remain pending, never release ownership. */
  produce: (request: CacheRangeWork, signal: AbortSignal) => Promise<T>;
  /** Full validation, final byte binding and delivery acknowledgement. */
  consume: (value: T, signal: AbortSignal) => Promise<void>;
  /** Release transient ownership or transfer it into charged cache ownership.
   * Resolving is not permission to forget bytes still held by a native reader. */
  release: (value: T) => Promise<void>;
  /** Request the common clock's original-return transaction. This callback
   * is notification only; it never acknowledges native fallback or cleanup. */
  failed: (reason: Error) => void;
}
interface Owned<T> {
  reservation: number;
  value: T | null;
  work: Promise<void>;
  released: boolean;
  cleanup: Promise<void> | null;
}

/** One producer overlaps one sequential verifier/delivery consumer. At most
 * two batches are reserved, including a closed producer waiting for consumer.
 * A new Session must drain this owner before replacing it. No native play,
 * seek, source switch, unbounded queue or implicit retry occurs here. */
export class CacheRangePipeline<T extends object> {
  private readonly abort = new AbortController();
  private readonly signal: AbortSignal;
  private readonly owned = new Set<Owned<T>>();
  private started = false;
  private usedBytes = 0;
  private error: Error | null = null;
  private active: Promise<void> | null = null;
  constructor(
    signal: AbortSignal,
    private readonly port: CacheRangePipelinePort<T>,
    private readonly limitBytes: number,
  ) {
    if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0)
      throw Error('RANGE_PIPELINE_CAPACITY');
    this.signal = AbortSignal.any([signal, this.abort.signal]);
  }
  get retainedBytes(): number {
    return this.usedBytes;
  }
  get failure(): Error | null {
    return this.error;
  }
  private fail(reason: unknown): void {
    if (this.error) return;
    this.error =
      reason instanceof Error ? reason : Error('RANGE_PIPELINE_FAILED');
    this.abort.abort(this.error);
    try {
      this.port.failed(this.error);
    } catch {
      /* Observer cannot release work. */
    }
  }
  private check(): void {
    this.signal.throwIfAborted();
  }
  private produce(request: CacheRangeWork): Owned<T> {
    this.check();
    if (
      this.owned.size >= 2 ||
      this.usedBytes + request.maximumBytes > this.limitBytes
    )
      throw Error('RANGE_PIPELINE_CAPACITY');
    const record: Owned<T> = {
      reservation: request.maximumBytes,
      value: null,
      work: Promise.resolve(),
      released: false,
      cleanup: null,
    };
    this.usedBytes += record.reservation;
    this.owned.add(record);
    // Install ownership before calling a port that may synchronously throw.
    record.work = Promise.resolve()
      .then(async () => {
        this.check();
        record.value = await this.port.produce(request, this.signal);
      })
      .catch((error) => {
        this.fail(error);
        throw error;
      });
    void record.work.catch(() => undefined);
    return record;
  }
  private release(record: Owned<T>): Promise<void> {
    if (record.cleanup) return record.cleanup;
    record.cleanup = (async () => {
      await record.work.catch(() => undefined);
      if (record.value !== null) await this.port.release(record.value);
      record.released = true;
      this.usedBytes -= record.reservation;
      this.owned.delete(record);
    })();
    return record.cleanup;
  }
  run(requests: readonly CacheRangeWork[]): Promise<void> {
    if (this.started) return Promise.reject(Error('RANGE_PIPELINE_USED'));
    this.started = true;
    const plan = requests.map((request) => ({ ...request }));
    const ids = new Set<number>();
    for (const request of plan) {
      if (
        !Number.isSafeInteger(request.id) ||
        request.id < 0 ||
        ids.has(request.id) ||
        !Number.isSafeInteger(request.maximumBytes) ||
        request.maximumBytes <= 0 ||
        request.maximumBytes > this.limitBytes
      )
        return Promise.reject(Error('RANGE_PIPELINE_REQUEST'));
      ids.add(request.id);
    }
    const aborted = (): void => this.fail(this.signal.reason);
    this.signal.addEventListener('abort', aborted, { once: true });
    if (this.signal.aborted) aborted();
    this.active = this.execute(plan).finally(() => {
      this.signal.removeEventListener('abort', aborted);
    });
    return this.active;
  }
  private async execute(plan: readonly CacheRangeWork[]): Promise<void> {
    let cleanupError: unknown;
    try {
      this.check();
      let next = plan.length ? this.produce(plan[0]) : null;
      for (let i = 0; i < plan.length; i++) {
        const current = next;
        if (!current) throw Error('RANGE_PIPELINE_MISSING');
        await current.work;
        this.check();
        if (current.value === null) throw Error('RANGE_PIPELINE_MISSING');
        // One completed producer, at most one subsequent producer. When the
        // next reservation cannot fit, consume/release first instead of overfill.
        const request = plan[i + 1];
        next =
          request && this.usedBytes + request.maximumBytes <= this.limitBytes
            ? this.produce(request)
            : null;
        await this.port.consume(current.value, this.signal);
        this.check();
        await this.release(current);
        this.check();
        if (request && !next) next = this.produce(request);
      }
    } catch (error) {
      this.fail(error);
    } finally {
      // A pending producer/consumer keeps execute and its reservations pending.
      // Close failure remains charged and is never retried by this owner.
      for (const record of [...this.owned]) {
        try {
          await this.release(record);
        } catch (error) {
          cleanupError ??= error;
          this.fail(error);
        }
      }
    }
    if (cleanupError)
      throw new CacheRangeFailure('RANGE_PIPELINE_CLEANUP', [
        this.error,
        cleanupError,
      ]);
    if (this.error) throw this.error;
  }
  cancel(): Promise<void> {
    this.abort.abort(Error('RANGE_PIPELINE_CANCELLED'));
    return this.active ?? Promise.resolve();
  }
}
