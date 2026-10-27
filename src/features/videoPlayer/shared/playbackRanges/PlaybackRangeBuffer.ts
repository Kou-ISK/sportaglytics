import { SourceBufferTaskQueue } from './SourceBufferTaskQueue';
import type { RangeSourceBufferPort } from './SourceBufferTaskQueue';
import { planPlaybackRange, validateRangeIndex } from './rangeBufferIndex';
import type {
  PlaybackRangeFragment,
  PlaybackRangeIndex,
} from './rangeBufferIndex';

export interface PlaybackRangeBufferPort extends RangeSourceBufferPort {
  readonly buffered: TimeRanges;
  appendBuffer: (bytes: ArrayBuffer) => void;
  remove: (start: number, end: number) => void;
}
export interface PlaybackRangeReader {
  /** IDs only. The adapter owns the verified file, byte/hash checks and lease. */
  read: (
    id: 'initialization' | number,
    signal: AbortSignal,
  ) => Promise<ArrayBuffer>;
  close: () => Promise<void>;
}
export interface PlaybackRangeVideoState {
  seeking: boolean;
  readyState: number;
  currentTime: number;
  error: unknown;
}

const contains = (ranges: TimeRanges, time: number): boolean => {
  for (let i = 0; i < ranges.length; i++)
    if (ranges.start(i) <= time && time < ranges.end(i)) return true;
  return false;
};

/** One source/Session owns this instance. Seek demands coalesce, whereas native
 * append/remove work is drained in order. A new demand cannot cancel and reuse
 * the same native operation's event stream. No play/currentTime writes here. */
export class PlaybackRangeBuffer {
  readonly index: PlaybackRangeIndex;
  private readonly queue: SourceBufferTaskQueue;
  private readonly abort = new AbortController();
  private readonly loaded = new Map<number, PlaybackRangeFragment>();
  private readonly retained = new Map<number, number>();
  private readonly detachment: Promise<void>;
  private confirmDetached: () => void = () => {};
  private targetTime = 0;
  private seekTime: number | null = null;
  private initialized = false;
  private stopped = false;
  private error: Error | null = null;
  private active: Promise<void> | null = null;
  private dirty = false;
  private reservedBytes = 0;
  private uncertainNativeBytes = 0;
  private closePromise: Promise<void> | null = null;

  constructor(
    index: PlaybackRangeIndex,
    private readonly buffer: PlaybackRangeBufferPort,
    private readonly reader: PlaybackRangeReader,
    private readonly onFailure: (error: Error) => void,
    private readonly currentMediaTime: () => number,
    private readonly limitBytes = 64 * 1024 * 1024,
    private readonly deadlineMs = 15000,
  ) {
    this.index = validateRangeIndex(index);
    this.detachment = new Promise((resolve) => {
      this.confirmDetached = resolve;
    });
    if (
      !Number.isSafeInteger(limitBytes) ||
      limitBytes <= index.initializationBytes
    )
      throw Error('RANGE_INVALID_CAPACITY');
    this.queue = new SourceBufferTaskQueue(
      buffer,
      (error) => this.fail(error),
      deadlineMs,
    );
  }

  get failure(): Error | null {
    return this.error;
  }
  get retainedBytes(): number {
    return (
      (this.initialized ? this.index.initializationBytes : 0) +
      this.reservedBytes +
      this.uncertainNativeBytes +
      [...this.retained.values()].reduce((sum, bytes) => sum + bytes, 0)
    );
  }

  demand(time: number): void {
    if (this.stopped || this.error) return;
    try {
      planPlaybackRange(this.index, time, 0);
      this.targetTime = time;
      this.dirty = true;
      this.pump();
    } catch (error) {
      this.fail(error);
    }
  }

  seek(time: number): void {
    this.seekTime = time;
    this.demand(time);
  }

  isReady(time: number, video: PlaybackRangeVideoState): boolean {
    if (
      this.stopped ||
      this.error ||
      !this.initialized ||
      video.error ||
      video.seeking ||
      video.readyState < 3
    )
      return false;
    if (this.seekTime !== null) {
      const first = this.index.fragments[0];
      const prefix =
        this.seekTime < first.videoStart &&
        video.currentTime >= this.seekTime &&
        video.currentTime <= first.videoStart;
      if (!prefix && Math.abs(video.currentTime - this.seekTime) > 0.002)
        return false;
    }
    try {
      const plan = planPlaybackRange(this.index, time, 0);
      const sampleTime = Math.max(
        plan.target.videoStart,
        Math.min(time, plan.target.videoEnd - 0.000001),
      );
      // updateend and a stale readyState cannot certify a different seek target.
      const ready =
        plan.required.every((row) => this.loaded.has(row.id)) &&
        contains(this.buffer.buffered, sampleTime);
      if (ready) this.seekTime = null;
      return ready;
    } catch {
      return false;
    }
  }

  private fail(value: unknown): void {
    if (this.error || this.stopped) return;
    this.error = value instanceof Error ? value : Error('RANGE_BUFFER_FAILED');
    try {
      this.onFailure(this.error);
    } catch {
      // Failed state remains observable; observer errors never acknowledge cleanup.
    }
  }

  private pump(): void {
    if (this.active || this.stopped || this.error) return;
    this.active = this.fill()
      .catch((error) => this.fail(error))
      .finally(() => {
        this.active = null;
        if (this.dirty && !this.stopped && !this.error) this.pump();
      });
  }

  private async read(
    id: 'initialization' | number,
    bytes: number,
  ): Promise<ArrayBuffer> {
    if (this.retainedBytes + bytes > this.limitBytes)
      throw Error('RANGE_CAPACITY_EXCEEDED');
    this.reservedBytes += bytes;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Timeout reports failure but the underlying reader remains owned by active
    // until it actually settles. No replacement read or close races that I/O.
    timer = setTimeout(
      () => this.fail(Error('RANGE_READ_UNCONFIRMED')),
      this.deadlineMs,
    );
    try {
      const data = await this.reader.read(id, this.abort.signal);
      this.abort.signal.throwIfAborted();
      if (data.byteLength !== bytes) throw Error('RANGE_READ_SIZE_CHANGED');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  private async append(
    id: 'initialization' | number,
    bytes: number,
  ): Promise<void> {
    let reserved = false;
    let nativeAttempted = false;
    let nativeAccounted = false;
    try {
      if (this.retainedBytes + bytes > this.limitBytes)
        throw Error('RANGE_CAPACITY_EXCEEDED');
      reserved = true;
      const data = await this.read(id, bytes);
      if (this.stopped || this.error) return;
      if (
        id !== 'initialization' &&
        !planPlaybackRange(this.index, this.targetTime, 4).ahead.some(
          (row) => row.id === id,
        )
      )
        return;
      try {
        await this.queue.run(() => {
          nativeAttempted = true;
          this.buffer.appendBuffer(data);
        }, this.abort.signal);
      } catch (error) {
        await this.queue.drained();
        throw error;
      }
      if (this.stopped || this.error) return;
      if (id === 'initialization') this.initialized = true;
      else {
        this.loaded.set(id, this.index.fragments[id]);
        // A partial prior eviction can leave native bytes even when coverage is
        // invalid. Reappend is charged again until the entire envelope is removed.
        this.retained.set(id, (this.retained.get(id) ?? 0) + bytes);
      }
      nativeAccounted = true;
    } finally {
      // Error/abort/updateend does not certify that accepted native frames were
      // removed. Keep their conservative charge until real source detachment.
      if (nativeAttempted && !nativeAccounted)
        this.uncertainNativeBytes += bytes;
      if (reserved) this.reservedBytes -= bytes;
    }
  }

  private async makeRoom(
    bytes: number,
    protectedIds: Set<number>,
  ): Promise<void> {
    while (this.retainedBytes + bytes > this.limitBytes) {
      if (this.stopped || this.error) return;
      const current = this.currentMediaTime();
      if (
        Number.isFinite(current) &&
        current >= 0 &&
        current < this.index.presentationEnd
      )
        for (const row of planPlaybackRange(this.index, current, 0).required)
          protectedIds.add(row.id);
      const retainedRows = [...this.retained.keys()].map(
        (id) => this.index.fragments[id],
      );
      const protectedRows = retainedRows.filter((row) =>
        protectedIds.has(row.id),
      );
      const victim = retainedRows.find(
        (row) =>
          !protectedIds.has(row.id) &&
          protectedRows.every(
            (keep) =>
              row.sampleEnd <= keep.sampleStart ||
              row.sampleStart >= keep.sampleEnd,
          ),
      );
      if (!victim) throw Error('RANGE_CAPACITY_PINNED');
      await this.queue.run(
        () => this.buffer.remove(victim.sampleStart, victim.sampleEnd),
        this.abort.signal,
      );
      if (this.stopped || this.error) return;
      // Only this full envelope is now confirmed removed. Overlapping records
      // lose coverage but retain their entire conservative byte charge.
      this.retained.delete(victim.id);
      // Removal can drop whole audio packets or the rest of a video dependency.
      // Invalidate every overlapping envelope, not just the selected victim ID.
      for (const row of this.loaded.values())
        if (
          row.sampleStart < victim.sampleEnd &&
          row.sampleEnd > victim.sampleStart
        )
          this.loaded.delete(row.id);
    }
  }

  private async fill(): Promise<void> {
    if (!this.initialized)
      await this.append('initialization', this.index.initializationBytes);
    while (this.dirty && !this.stopped && !this.error) {
      this.dirty = false;
      const plan = planPlaybackRange(this.index, this.targetTime, 4);
      const requiredIds = new Set(plan.required.map((row) => row.id));
      const requiredBytes = plan.required.reduce(
        (sum, row) => sum + row.bytes,
        this.index.initializationBytes,
      );
      if (requiredBytes > this.limitBytes)
        throw Error('RANGE_TARGET_EXCEEDS_CAPACITY');
      for (const row of plan.ahead) {
        if (this.stopped || this.error) return;
        const latest = planPlaybackRange(this.index, this.targetTime, 4);
        if (!latest.ahead.some((needed) => needed.id === row.id)) {
          this.dirty = true;
          break;
        }
        if (this.loaded.has(row.id)) continue;
        if (
          !requiredIds.has(row.id) &&
          this.retainedBytes + row.bytes > this.limitBytes
        )
          break;
        await this.makeRoom(
          row.bytes,
          new Set(latest.required.map((item) => item.id)),
        );
        if (this.stopped || this.error) return;
        await this.append(row.id, row.bytes);
      }
      if (!this.dirty && !this.stopped && !this.error) {
        const latest = planPlaybackRange(this.index, this.targetTime, 0);
        const sampleTime = Math.max(
          latest.target.videoStart,
          Math.min(this.targetTime, latest.target.videoEnd - 0.000001),
        );
        if (
          latest.required.every((row) => this.loaded.has(row.id)) &&
          !contains(this.buffer.buffered, sampleTime)
        )
          throw Error('RANGE_NATIVE_COVERAGE_LOST');
      }
    }
  }

  /** The actual MediaSource sourceclose acknowledges native detachment. */
  sourceClosed(): void {
    this.queue.sourceClosed();
    this.confirmDetached();
    if (!this.stopped) this.fail(Error('RANGE_SOURCE_CLOSED'));
  }

  /** Caller pauses the common clock and switches to original through its ACK
   * transaction. A failed/uncertain close stays rejected; it is not retried. */
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopped = true;
    this.abort.abort();
    this.closePromise = (async () => {
      await this.active;
      await this.queue.drained();
      await this.detachment;
      await this.reader.close();
      this.loaded.clear();
      this.retained.clear();
      this.initialized = false;
      this.uncertainNativeBytes = 0;
    })();
    return this.closePromise;
  }
}
