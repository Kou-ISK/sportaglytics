import type { PlaybackCacheStatus } from '../../../src/types/playbackCache';
import {
  hasCacheCapacity,
  isCacheValidationMatching,
  isCacheExpectationValid,
} from './cachePolicy';
import type { CacheExpectation, CacheValidation } from './cachePolicy';

/** Trusted Main adapters own a private staging directory and one child process.
 * convert/validate settle only after their owned work stops. publish must atomically
 * expose a complete, immutable cache or reject without exposing one. discard is
 * idempotent and only removes this job's staging. No adapter can write the source. */
export interface CacheJobPorts {
  capacity: () => Promise<{
    freeBytes: number;
    reserveBytes: number;
    maxBytes: number;
  }>;
  convert: (
    signal: AbortSignal,
    progress: (fraction: number) => void,
    budget: { maxBytes: number; reserveBytes: number },
  ) => Promise<void>;
  validate: (signal: AbortSignal) => Promise<CacheValidation>;
  publish: () => Promise<string>;
  discard: () => Promise<void>;
}

/** Foundation coordinator: deliberately has no production FFmpeg/IPC adapter yet. */
export class PlaybackCacheJob {
  private state: PlaybackCacheStatus = {
    phase: 'original',
    progress: null,
    selected: 'original',
    error: null,
  };
  private active: AbortController | null = null;
  private artifact: string | null = null;
  private cleanupRequired = false;

  constructor(
    private readonly ports: CacheJobPorts,
    private readonly notify: (state: PlaybackCacheStatus) => void,
  ) {}

  get status(): PlaybackCacheStatus {
    return { ...this.state };
  }

  private update(change: Partial<PlaybackCacheStatus>): void {
    this.state = { ...this.state, ...change };
    // Observers do not own conversion/publication. A gone UI must not strand a
    // job or turn an already committed artifact into an operation failure.
    try {
      this.notify(this.status);
    } catch {
      console.warn('Playback cache status observer unavailable');
    }
  }

  async start(
    expectation: CacheExpectation,
    estimatedBytes: number,
  ): Promise<void> {
    if (this.active || this.cleanupRequired || this.state.selected === 'cache')
      throw new Error('CACHE_BUSY');
    // Freeze the request before awaiting I/O: callers cannot change its proof mid-job.
    const expected = structuredClone(expectation);
    const controller = new AbortController();
    this.active = controller;
    this.artifact = null;
    this.update({ phase: 'converting', progress: null, error: null });
    let error: PlaybackCacheStatus['error'] = 'operation';
    try {
      if (!isCacheExpectationValid(expected)) {
        error = 'validation';
        throw new Error('CACHE_INVALID_EXPECTATION');
      }
      const limits = await this.ports.capacity();
      controller.signal.throwIfAborted();
      if (!hasCacheCapacity(estimatedBytes, limits)) {
        error = 'capacity';
        throw new Error('CACHE_CAPACITY');
      }
      await this.ports.convert(
        controller.signal,
        (fraction) => {
          if (
            this.active !== controller ||
            controller.signal.aborted ||
            this.state.phase !== 'converting' ||
            !Number.isFinite(fraction)
          )
            return;
          this.update({
            progress: Math.max(
              this.state.progress ?? 0,
              Math.min(1, Math.max(0, fraction)),
            ),
          });
        },
        { maxBytes: limits.maxBytes, reserveBytes: limits.reserveBytes },
      );
      controller.signal.throwIfAborted();
      this.update({ phase: 'validating', progress: null });
      const validation = await this.ports.validate(controller.signal);
      controller.signal.throwIfAborted();
      if (!isCacheValidationMatching(expected, validation)) {
        error = 'validation';
        throw new Error('CACHE_VALIDATION');
      }
      if (validation.outputBytes > limits.maxBytes) {
        error = 'capacity';
        throw new Error('CACHE_CAPACITY');
      }
      // Publication is an atomic commit; cancellation is accepted only before it.
      this.update({ phase: 'publishing' });
      this.artifact = await this.ports.publish();
      if (!this.artifact) throw new Error('CACHE_EMPTY_ARTIFACT');
      this.update({ phase: 'ready', progress: null });
    } catch {
      this.artifact = null;
      try {
        await this.ports.discard();
      } catch {
        this.cleanupRequired = true;
        error = 'cleanup';
      }
      this.update({
        phase:
          controller.signal.aborted && !this.cleanupRequired
            ? 'original'
            : 'failed',
        progress: null,
        error:
          controller.signal.aborted && !this.cleanupRequired ? null : error,
      });
    } finally {
      this.active = null;
    }
  }

  cancel(): boolean {
    if (
      !this.active ||
      !['converting', 'validating'].includes(this.state.phase)
    )
      return false;
    this.active.abort();
    this.update({ phase: 'cancelling' });
    return true;
  }

  /** Choosing the source does not cancel an outstanding conversion or delete files. */
  useOriginal(): void {
    this.update({ selected: 'original' });
  }

  /** Return the opaque artifact ID only at an explicit, paused switch boundary. */
  selectCache(paused: boolean): string | null {
    if (
      !paused ||
      this.active ||
      this.state.phase !== 'ready' ||
      !this.artifact
    )
      return null;
    this.update({ selected: 'cache' });
    return this.artifact;
  }

  async retryCleanup(): Promise<void> {
    if (this.active || !this.cleanupRequired) return;
    const controller = new AbortController();
    this.active = controller;
    try {
      await this.ports.discard();
      this.cleanupRequired = false;
      this.update({ phase: 'original', error: null });
    } finally {
      this.active = null;
    }
  }
}
