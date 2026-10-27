import {
  parseNativePlaybackIntent,
  parseNativePlaybackObservation,
  parseNativePlaybackClosed,
  parseNativePlaybackOwner,
} from '../../../src/types/ipc/nativePlayback';
import type {
  NativePlaybackOwner,
  NativePlaybackIntent,
  NativePlaybackObservation,
  NativePlaybackClosed,
} from '../../../src/types/ipc/nativePlayback';

import type { NativePlaybackFailure } from '../../../src/types/ipc/nativePlaybackFailure';

/** write resolves on delivery only. It is never a seek/play readiness ACK. */
export interface NativePlaybackBackend {
  reportFailure?: (failure: NativePlaybackFailure) => void;
  write: (intent: NativePlaybackIntent) => Promise<void>;
  close: () => Promise<NativePlaybackClosed>;
}
export interface NativePlaybackScope {
  owner: NativePlaybackOwner;
  start: number;
  end: number;
  audioTracks: number;
  rates: readonly number[];
}
const sameOwner = (a: NativePlaybackOwner, b: NativePlaybackOwner): boolean =>
  a.generation === b.generation && a.sourceKey === b.sourceKey;

/** Main owns this object through child/reader/renderer/pipe drainage. It has no
 * filesystem writes and cannot modify package/tag/export metadata. */
export class NativePlaybackSession {
  private intent: NativePlaybackIntent | null = null;
  private pending: NativePlaybackIntent | null = null;
  private delivery: Promise<void> | null = null;
  private observation: NativePlaybackObservation | null = null;
  private lastRevision = 0;
  private issuedSequence = 0;
  private issuedIntents = new Map<number, NativePlaybackIntent>();
  private processedSequence = 0;
  private anchoredSeek = 0;
  private bufferedStop: { seekId: number; time: number } | null = null;
  private error: NativePlaybackObservation['error'] = null;
  private closing = false;
  private closed: NativePlaybackClosed | null = null;
  private closeOperation: Promise<NativePlaybackClosed> | null = null;
  private lastTime: number;

  constructor(
    readonly scope: NativePlaybackScope,
    private readonly backend: NativePlaybackBackend,
    private readonly changed: () => void = () => {},
  ) {
    if (
      !Number.isFinite(scope.start) ||
      !Number.isFinite(scope.end) ||
      scope.start < 0 ||
      scope.end > 86400 ||
      scope.end <= scope.start ||
      !Number.isInteger(scope.audioTracks) ||
      scope.audioTracks < 1 ||
      scope.audioTracks > 8 ||
      scope.rates.length === 0 ||
      scope.rates.some(
        (rate) => !Number.isFinite(rate) || rate < 0.25 || rate > 6,
      )
    )
      throw Error('NATIVE_INVALID_SCOPE');
    this.scope = Object.freeze({
      ...scope,
      owner: Object.freeze(parseNativePlaybackOwner(scope.owner)),
      rates: Object.freeze([...scope.rates]),
    });
    this.lastTime = scope.start;
  }

  apply(raw: NativePlaybackIntent): void {
    const next = parseNativePlaybackIntent(raw);
    if (this.closing || this.error || !sameOwner(next, this.scope.owner))
      throw Error('NATIVE_OWNER_UNAVAILABLE');
    if (
      next.targetTime < this.scope.start ||
      next.targetTime >= this.scope.end ||
      next.audioTrack >= this.scope.audioTracks ||
      !this.scope.rates.includes(next.rate)
    )
      throw Error('NATIVE_UNQUALIFIED_INTENT');
    const old = this.intent;
    if (
      (old &&
        (next.sequence <= old.sequence ||
          next.seekId < old.seekId ||
          (next.seekId === old.seekId &&
            next.targetTime !== old.targetTime))) ||
      (!old && (next.seekId !== 1 || next.playing))
    )
      throw Error('NATIVE_INVALID_INTENT_ORDER');
    this.intent = next;
    this.pending = next; // Exactly one latest full intent, not an accumulating seek queue.
    this.flush();
  }

  private flush(): void {
    if (this.delivery || !this.pending || this.closing || this.error) return;
    const next = this.pending;
    this.pending = null;
    // Keep ownership if the writer never settles. close() must still cancel the
    // backend independently and cannot acknowledge while delivery is unknown.
    const work = Promise.resolve().then(() => {
      if (!this.closing && !this.error) {
        if (this.issuedIntents.size >= 256)
          throw Error('NATIVE_COMMAND_ACK_BOUND');
        this.issuedSequence = next.sequence;
        this.issuedIntents.set(next.sequence, next);
        return this.backend.write({ ...next });
      }
    });
    this.delivery = work
      .then(
        () => {},
        () => {
          this.fail('protocol');
        },
      )
      .finally(() => {
        this.delivery = null;
        this.flush();
      });
  }

  observe(raw: unknown): boolean {
    if (this.closing || this.error) return false;
    let value: NativePlaybackObservation;
    try {
      value = parseNativePlaybackObservation(raw);
    } catch {
      this.fail('protocol');
      return false;
    }
    if (!sameOwner(value, this.scope.owner)) return false;
    if (value.revision <= this.lastRevision) return false;
    this.lastRevision = value.revision;
    const intent = this.intent;
    if (!intent || value.sequence < this.processedSequence) return false;
    const processed = this.issuedIntents.get(value.sequence);
    if (
      !processed ||
      value.sequence > this.issuedSequence ||
      value.seekId !== processed.seekId ||
      value.time < this.scope.start ||
      value.time > this.scope.end ||
      value.audioTrack !== processed.audioTrack ||
      value.volume !== processed.volume ||
      value.muted !== processed.muted ||
      (value.phase === 'playing' &&
        (!processed.playing || value.rate !== processed.rate))
    ) {
      this.fail('protocol');
      return false;
    }
    // Delivery is not processing. Retain the bounded unacknowledged intents so
    // a terminal failure of the prior processed command can still drain safely.
    this.processedSequence = value.sequence;
    for (const sequence of this.issuedIntents.keys()) {
      if (sequence < value.sequence) this.issuedIntents.delete(sequence);
    }
    if (value.phase === 'closed' || value.phase === 'closing') {
      this.fail('cleanup');
      return false;
    }
    if (value.error || value.phase === 'failed') {
      this.fail(value.error ?? 'media');
      return false;
    }
    if (value.sequence < intent.sequence || value.seekId < intent.seekId)
      return false;
    if (value.phase === 'buffering') {
      if (
        this.anchoredSeek !== value.seekId ||
        value.time < this.lastTime ||
        (this.bufferedStop?.seekId === value.seekId &&
          value.time !== this.bufferedStop.time)
      ) {
        this.fail('protocol');
        return false;
      }
      this.bufferedStop = { seekId: value.seekId, time: value.time };
    }
    if (
      this.anchoredSeek === value.seekId &&
      value.videoReady &&
      value.audioReady &&
      (value.phase === 'paused' || value.phase === 'playing') &&
      (value.time < this.lastTime ||
        (this.bufferedStop?.seekId === value.seekId &&
          value.time < this.bufferedStop.time))
    ) {
      this.fail('protocol');
      return false;
    }
    // Every new seek must first stop at the exact requested source clock with
    // both media ranges ready. A write receipt or a running clock is not a seek ACK.
    if (
      this.anchoredSeek !== value.seekId &&
      value.videoReady &&
      value.audioReady
    ) {
      if (value.phase !== 'paused' || value.time !== intent.targetTime) {
        this.fail('protocol');
        return false;
      }
      this.anchoredSeek = value.seekId;
    }
    this.observation = value;
    if (
      (value.phase === 'paused' || value.phase === 'playing') &&
      value.videoReady &&
      value.audioReady
    ) {
      this.lastTime = value.time;
      this.bufferedStop = null;
    }
    this.changed();
    return true;
  }

  snapshot(): {
    intent: NativePlaybackIntent | null;
    observation: NativePlaybackObservation | null;
    lastConfirmedTime: number;
    error: NativePlaybackObservation['error'];
    closing: boolean;
    closed: boolean;
  } {
    const value = this.observation;
    const current =
      value &&
      this.intent &&
      value.sequence === this.intent.sequence &&
      value.seekId === this.intent.seekId;
    return {
      intent: this.intent && { ...this.intent },
      observation:
        current && !this.error && !this.closing ? { ...value } : null,
      lastConfirmedTime: this.lastTime,
      error: this.error,
      closing: this.closing,
      closed: this.closed !== null,
    };
  }

  fail(reason: NonNullable<NativePlaybackObservation['error']>): void {
    if (this.error) return;
    this.error = reason;
    this.pending = null;
    // Backend close is also the pause/cancel request. No fallback completion here.
    const alreadyClosing = this.closeOperation !== null;
    void this.close().catch(() => {});
    if (alreadyClosing) this.changed();
  }

  close(): Promise<NativePlaybackClosed> {
    if (this.closeOperation) return this.closeOperation;
    this.closing = true;
    this.pending = null;
    const delivery = this.delivery;
    this.closeOperation = (async () => {
      // Request normal cancellation before awaiting a possibly blocked writer.
      const raw = await this.backend.close();
      await delivery;
      const result = parseNativePlaybackClosed(raw);
      if (
        result.generation !== this.scope.owner.generation ||
        !result.nativeDrained ||
        !result.processExited ||
        !result.pipesClosed
      )
        throw Error('NATIVE_CLEANUP_UNCONFIRMED');
      const stopped = result.stopped;
      const processed = stopped
        ? this.issuedIntents.get(stopped.sequence)
        : null;
      if (
        stopped &&
        (!result.processStarted ||
          !sameOwner(stopped, this.scope.owner) ||
          !processed ||
          stopped.sequence < this.processedSequence ||
          stopped.seekId !== processed.seekId ||
          stopped.time < this.scope.start ||
          stopped.time > this.scope.end ||
          (stopped.seekId === this.anchoredSeek &&
            stopped.time < this.lastTime))
      )
        throw Error('NATIVE_STOP_CLOCK_UNCONFIRMED');
      this.closed = result;
      this.changed();
      return { ...result };
    })().catch((error: unknown) => {
      this.error = 'cleanup';
      this.changed();
      throw error;
    });
    this.changed();
    return this.closeOperation;
  }
}
