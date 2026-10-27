import { reportNativeFailure } from './nativeFailureReport';
import type { VideoSeekMode } from '../../../../types/video/seek';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import type { NativePlaybackPresentation } from '../../../../types/ipc/nativePlaybackPresentation';
import type { IElectronAPI } from '../../../../renderer';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
  NativePlaybackSnapshot,
} from '../../../../types/ipc/nativePlayback';
import {
  parseNativePlaybackClosed,
  parseNativePlaybackIntent,
  parseNativePlaybackSnapshot,
} from '../../../../types/ipc/nativePlayback';

export interface NativePlaybackControls {
  playing: boolean;
  rate: number;
  audioTrack: number;
  volume: number;
  muted: boolean;
}
export interface NativePlaybackState {
  phase: 'opening' | 'active' | 'closing' | 'failed' | 'original';
  time: number;
  observation: NativePlaybackSnapshot['observation'];
  error: string | null;
  /** A verified stopped HTML image, while latest recovery still owns its lease. */
  originalPreviewTime: number | null;
}
export interface NativeOriginalRecovery {
  pause: () => void;
  // Must verify stopped original frame, source generation and audio settings.
  restore: (
    time: number,
    controls: NativePlaybackControls,
    signal: AbortSignal,
  ) => Promise<void>;
  release: () => void;
  restored?: (time: number, controls: NativePlaybackControls) => void;
}
/** Commands are desired state. Only native observations advance the product
 * clock. One pending command and one poll; no per-frame seek feedback. */
export class NativePlaybackController {
  private intent: NativePlaybackIntent;
  private state: NativePlaybackState;
  private listeners = new Set<() => void>();
  private pending: NativePlaybackIntent | null = null;
  private writer: Promise<void> | null = null;
  private opened: Promise<void>;
  private closeWork: Promise<void> | null = null;
  private recoveryWork: Promise<void> | null = null;
  private explicitRecoveryWork: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastRevision = 0;
  private lastResponse = performance.now();
  private readyDeadline: number | null = performance.now() + 5000;
  private bufferingDeadline: number | null = null;
  private bufferedStop: { seekId: number; time: number } | null = null;
  private recoveryAbort: AbortController | null = null;
  private restoreAttempt: AbortController | null = null;
  private watchdog: ReturnType<typeof setInterval>;
  private lastReadySeek = 0;
  private fallingBack = false;
  private recoveryRevision = 0;
  private recoveryTime: number | null = null;
  private stoppedTime: number | null = null;
  constructor(
    private readonly api: IElectronAPI['nativePlayback'],
    readonly owner: NativePlaybackOwner,
    readonly sourceUrl: string,
    time: number,
    controls: NativePlaybackControls,
    private readonly original: NativeOriginalRecovery,
    private readonly presentation: NativePlaybackPresentation | null = null,
  ) {
    this.intent = {
      ...owner,
      ...controls,
      playing: false,
      sequence: 1,
      seekId: 1,
      targetTime: time,
    };
    this.state = {
      phase: 'opening',
      time,
      observation: null,
      error: null,
      originalPreviewTime: null,
    };
    this.original.pause();
    this.watchdog = setInterval(() => {
      if (this.state.phase === 'active' || this.state.phase === 'opening')
        this.checkDeadline();
    }, 250);
    this.opened = Promise.resolve()
      .then(() => {
        if (this.state.phase !== 'opening' || !this.checkDeadline()) return;
        return api.open({ ...owner });
      })
      .then(() => {
        if (this.state.phase !== 'opening' || !this.checkDeadline()) return;
        this.unsubscribe = api.onSnapshot({ ...owner }, (value) =>
          this.receive(value),
        );
        this.update({ phase: 'active' });
        if (this.snapshot().phase !== 'active') return;
        this.pending = { ...this.intent };
        this.flush();
        this.poll();
      })
      .catch(() => {
        if (this.state.phase === 'opening') this.fail('NATIVE_OPEN_FAILED');
      });
  }
  snapshot = (): NativePlaybackState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: Partial<NativePlaybackState>): void {
    this.state = { ...this.state, ...value };
    let failed = false;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        failed = true;
      }
    }
    if (
      failed &&
      (this.state.phase === 'active' || this.state.phase === 'opening')
    )
      this.fail('NATIVE_STATE_LISTENER_FAILED');
  }
  controls(value: Partial<NativePlaybackControls>): void {
    if (!this.acceptsOperation()) return;
    const changed = Object.entries(value).some(
      ([key, next]) =>
        this.intent[key as keyof NativePlaybackControls] !== next,
    );
    if (!changed) return;
    const next: NativePlaybackIntent = {
      ...this.intent,
      ...value,
      sequence: this.intent.sequence + 1,
    };
    // A new toolbar operation ends an interrupted scrub at its latest target.
    // Repeated React settings with no change above must not commit a held drag.
    if (next.seekMode === 'preview') {
      next.seekMode = 'scrub';
      next.seekId++;
    }
    if (this.routeToOriginal(next, false)) return;
    this.intent = next;
    this.readyDeadline = Math.min(
      performance.now() + 5000,
      this.bufferingDeadline ?? Infinity,
    );
    this.pending = { ...this.intent };
    this.update({ observation: null });
    this.flush();
  }
  seek(time: number, mode: VideoSeekMode = 'exact'): void {
    if (!this.acceptsOperation()) return;
    if (!Number.isFinite(time) || time < 0 || time > 86400) {
      this.fail('NATIVE_INVALID_SEEK');
      return;
    }
    // Pointer release can repeat a still-pending stopped target. Keep that
    // operation and its deadline; issuing it again would cancel useful decode.
    if (
      this.state.phase === 'active' &&
      !this.fallingBack &&
      !this.intent.playing &&
      !this.hasConfirmedSeek &&
      time === this.intent.targetTime &&
      (this.intent.seekMode ?? 'exact') === mode
    )
      return;
    const next: NativePlaybackIntent = {
      ...this.intent,
      sequence: this.intent.sequence + 1,
      seekId: this.intent.seekId + 1,
      targetTime: time,
    };
    if (mode !== 'exact') next.seekMode = mode;
    else delete next.seekMode;
    if (this.routeToOriginal(next, true)) return;
    this.intent = next;
    this.bufferingDeadline = null;
    this.bufferedStop = null;
    this.readyDeadline = performance.now() + 5000;
    this.pending = { ...this.intent };
    this.update({ observation: null });
    this.flush();
  }
  /** Relative commands build on a pending seek, as the HTML currentTime setter
   * does. This never advances the confirmed playback/tag/save clock. */
  get seekCommandTime(): number {
    return this.lastReadySeek === this.intent.seekId
      ? this.state.time
      : this.intent.targetTime;
  }
  get requestedControls(): NativePlaybackControls {
    const { playing, rate, audioTrack, volume, muted } = this.intent;
    return { playing, rate, audioTrack, volume, muted };
  }
  finishPreview(): void {
    if (this.intent.seekMode === 'preview')
      this.seek(this.intent.targetTime, 'scrub');
  }
  get isFallingBack(): boolean {
    return this.fallingBack;
  }
  private isPreviewing(): boolean {
    return this.intent.seekMode === 'preview';
  }
  private acceptsOperation(): boolean {
    if (this.state.phase === 'active' && this.checkDeadline()) return true;
    // The operation itself can detect the expired refill and initiate fallback.
    // Re-evaluate ownership so that its pause/seek is not lost at that boundary.
    return this.fallingBack && this.state.phase === 'closing';
  }
  private routeToOriginal(
    next: NativePlaybackIntent,
    seeking: boolean,
  ): boolean {
    try {
      parseNativePlaybackIntent(next);
    } catch {
      this.fail('NATIVE_INVALID_COMMAND');
      return true;
    }
    if (
      !this.fallingBack &&
      (!this.presentation ||
        nativePresentationSupports(
          this.presentation,
          next,
          this.intent.audioTrack,
        ))
    )
      return false;
    this.intent = next;
    this.recoveryRevision++;
    // Keep one stopped original decode in flight during positional scrubbing.
    // Cancelling on every pointer move can prevent any image from completing.
    // Changed controls must still cancel their obsolete settings immediately.
    if (!seeking) this.restoreAttempt?.abort();
    if (seeking) this.recoveryTime = next.targetTime;
    this.fallingBack = true;
    this.pending = null;
    // All entrances (toolbar, timeline, remote seek and reverse keys) share this
    // path. A newer operation replaces the pending one while native drains.
    this.continueFallback();
    return true;
  }
  private continueFallback(): void {
    // A failed preview may drain immediately, but must not start the original
    // player while the pointer is still held. Keep only the latest intent until
    // release/capture loss/window close commits it. No native decoder remains.
    const work =
      this.intent.seekMode === 'preview'
        ? this.closeNative()
        : this.startRecovery();
    void work.catch(() => this.fail('NATIVE_RECOVERY_UNCONFIRMED'));
  }
  private flush(): void {
    if (this.writer || !this.pending || this.state.phase !== 'active') return;
    const value = this.pending;
    this.pending = null;
    this.writer = Promise.resolve()
      .then(() => {
        if (this.state.phase === 'active' && this.checkDeadline())
          return this.api.apply(value);
      })
      .catch(() => {
        if (this.state.phase === 'active') this.fail('NATIVE_COMMAND_FAILED');
      })
      .finally(() => {
        this.writer = null;
        this.flush();
      });
  }
  private checkDeadline(): boolean {
    const now = performance.now();
    if (
      now - this.lastResponse > 5000 ||
      (this.readyDeadline !== null && now >= this.readyDeadline)
    ) {
      // The bounded host refill and its terminal IPC can race this watchdog.
      // A measured buffering state may converge through verified drainage;
      // do not accept a late ready ACK or extend the deadline. Unknown close,
      // stopped clock or original image still retains the existing lease.
      if (this.bufferingDeadline !== null && this.presentation)
        this.beginMediaFallback('NATIVE_RESPONSE_TIMEOUT');
      else this.fail('NATIVE_RESPONSE_TIMEOUT');
      return false;
    }
    return true;
  }
  private beginMediaFallback(reason: string): void {
    this.fallingBack = true;
    this.pending = null;
    this.update({ error: reason });
    this.continueFallback();
  }
  private receive(raw: unknown): void {
    try {
      if (this.state.phase !== 'active' || !this.checkDeadline()) return;
      const value = parseNativePlaybackSnapshot(raw);
      if (value.error || value.closing || value.closed) {
        if (value.error === 'media' && this.presentation) {
          // A measured media failure may recover only after confirmed native
          // drainage and original restoration. Cleanup/protocol faults stay held.
          this.beginMediaFallback('NATIVE_MEDIA_FALLBACK');
          return;
        }
        this.fail(value.error ?? 'NATIVE_UNEXPECTED_CLOSE');
        return;
      }
      const observation = value.observation;
      if (
        !observation ||
        observation.generation !== this.owner.generation ||
        observation.sourceKey !== this.owner.sourceKey ||
        observation.sequence !== this.intent.sequence ||
        observation.seekId !== this.intent.seekId ||
        observation.revision <= this.lastRevision
      )
        return;
      this.lastResponse = performance.now();
      this.lastRevision = observation.revision;
      if (observation.phase === 'buffering') {
        this.bufferedStop = {
          seekId: observation.seekId,
          time: observation.time,
        };
        this.bufferingDeadline ??= performance.now() + 5000;
        this.readyDeadline = Math.min(
          this.readyDeadline ?? Infinity,
          this.bufferingDeadline,
        );
      }
      const ready =
        observation.videoReady &&
        observation.audioReady &&
        (observation.phase === 'paused' || observation.phase === 'playing');
      const preview = this.intent.seekMode === 'preview';
      if (ready) {
        this.lastReadySeek = observation.seekId;
        if (
          observation.phase ===
          (!preview && this.intent.playing ? 'playing' : 'paused')
        ) {
          this.readyDeadline = null;
          this.bufferingDeadline = null;
          this.bufferedStop = null;
        }
      }
      this.update({
        observation,
        ...(ready ? { time: value.lastConfirmedTime } : {}),
      });
      if (
        ready &&
        !preview &&
        this.presentation &&
        observation.phase === 'paused' &&
        observation.time >= this.presentation.playEnd
      ) {
        this.fallingBack = true;
        this.pending = null;
        void this.returnToOriginal().catch(() => {});
      }
    } catch {
      if (this.state.phase === 'active') this.fail('NATIVE_OBSERVATION_FAILED');
    }
  }
  private poll(): void {
    if (this.state.phase !== 'active') return;
    // One initial snapshot closes the subscribe/open race. Later updates come
    // from Main; Renderer timers may be throttled behind a native surface.
    void this.api
      .observe({ ...this.owner })
      .then((raw) => this.receive(raw))
      .catch(() => {
        if (this.state.phase === 'active')
          this.fail('NATIVE_OBSERVATION_FAILED');
      });
  }
  get hasConfirmedSeek(): boolean {
    return this.lastReadySeek === this.intent.seekId;
  }
  fail(reason: string): void {
    if (this.state.phase === 'original' || this.state.phase === 'failed')
      return;
    reportNativeFailure(
      this.api,
      this.owner,
      this.intent,
      this.state.time,
      1,
      reason,
    );
    this.recoveryAbort?.abort();
    this.pauseOriginal();
    this.pending = null;
    this.disconnectObserver();
    clearInterval(this.watchdog);
    this.update({ phase: 'failed', observation: null, error: reason });
    // Pause/cancel promptly, but keep the renderer lease until an explicit,
    // verified stopped-original restoration. Unknown close cannot unlock it.
    void this.drain().catch(() => {});
  }
  private disconnectObserver(): void {
    const unsubscribe = this.unsubscribe;
    this.unsubscribe = null;
    try {
      unsubscribe?.();
    } catch {
      /* A detached preload must not prevent native drain. */
    }
  }
  private pauseOriginal(): boolean {
    try {
      this.original.pause();
      return true;
    } catch {
      // A disposed HTML player must not prevent native cancellation/drain.
      return false;
    }
  }
  private drain(): Promise<void> {
    if (this.closeWork) return this.closeWork;
    this.pending = null;
    this.disconnectObserver();
    clearInterval(this.watchdog);
    this.closeWork = (async () => {
      const result = parseNativePlaybackClosed(
        await this.api.close({ ...this.owner }),
      );
      await this.opened;
      await this.writer;
      if (
        result.generation !== this.owner.generation ||
        !result.nativeDrained ||
        !result.processExited ||
        !result.pipesClosed
      )
        throw Error('NATIVE_CLEANUP_UNCONFIRMED');
      const stopped = result.stopped;
      if (stopped) {
        if (
          stopped.sourceKey !== this.owner.sourceKey ||
          stopped.sequence > this.intent.sequence ||
          stopped.seekId > this.intent.seekId ||
          (stopped.seekId === this.lastReadySeek &&
            stopped.time < this.state.time) ||
          (stopped.seekId === this.bufferedStop?.seekId &&
            stopped.time < this.bufferedStop.time)
        )
          throw Error('NATIVE_STOP_CLOCK_UNCONFIRMED');
        this.stoppedTime = stopped.time;
      } else if (this.lastReadySeek > 0) {
        throw Error('NATIVE_STOP_CLOCK_MISSING');
      }
    })();
    return this.closeWork;
  }
  /** Closing native ownership does not acknowledge original media restoration. */
  closeNative(): Promise<void> {
    const paused = this.pauseOriginal();
    this.update({
      phase: paused ? 'closing' : 'failed',
      observation: null,
      ...(paused ? {} : { error: 'NATIVE_ORIGINAL_PAUSE_FAILED' }),
    });
    return this.drain();
  }
  returnToOriginal(): Promise<void> {
    if (this.explicitRecoveryWork) return this.explicitRecoveryWork;
    const work = this.finishOriginalRecovery();
    this.explicitRecoveryWork = work;
    void work.catch(() => {
      if (this.explicitRecoveryWork === work) this.explicitRecoveryWork = null;
    });
    return work;
  }
  private async finishOriginalRecovery(): Promise<void> {
    // Explicit document/recovery actions finish a held gesture. Unlike the
    // internal fallback pump, success here promises restoration and release.
    do {
      if (this.isPreviewing()) {
        // Recovery also works after fail/close, when ordinary seek() correctly
        // rejects input. End the gesture without sending to the drained host.
        this.intent = {
          ...this.intent,
          seekMode: 'scrub',
          sequence: this.intent.sequence + 1,
          seekId: this.intent.seekId + 1,
        };
        this.recoveryTime = this.intent.targetTime;
        this.recoveryRevision++;
      }
      await this.startRecovery();
    } while (this.state.phase === 'closing');
    if (this.state.phase !== 'original')
      throw Error('NATIVE_RECOVERY_UNCONFIRMED');
  }
  private startRecovery(): Promise<void> {
    if (this.recoveryWork) return this.recoveryWork;
    const work = this.recoverOriginal();
    this.recoveryWork = work;
    void work.then(
      () => {
        if (this.recoveryWork !== work || this.state.phase !== 'closing')
          return;
        this.recoveryWork = null;
        // A pointer gesture can supersede an in-flight original restore. Resume
        // only if its release arrived while that stopped restore was settling.
        if (this.fallingBack && this.intent.seekMode !== 'preview')
          this.continueFallback();
      },
      () => {},
    );
    void work.catch(() => {
      if (this.recoveryWork === work) this.recoveryWork = null;
    });
    return work;
  }
  private async recoverOriginal(): Promise<void> {
    if (this.state.phase === 'original') return;
    const paused = this.pauseOriginal();
    this.update({ phase: 'closing', observation: null });
    const abort = new AbortController();
    this.recoveryAbort = abort;
    const deadline = setTimeout(
      () => this.fail('NATIVE_RECOVERY_TIMEOUT'),
      20000,
    );
    try {
      await this.drain();
      if (!paused) throw Error('NATIVE_ORIGINAL_PAUSE_FAILED');
      let restoredTime: number;
      let restoredControls: NativePlaybackControls;
      while (true) {
        if (this.isPreviewing()) return;
        const revision = this.recoveryRevision;
        restoredTime =
          this.recoveryTime ??
          (this.lastReadySeek !== this.intent.seekId
            ? this.intent.targetTime
            : (this.stoppedTime ?? this.state.time));
        restoredControls = {
          playing:
            this.fallingBack &&
            this.intent.seekMode !== 'preview' &&
            this.intent.playing,
          rate: this.intent.rate,
          audioTrack: this.intent.audioTrack,
          volume: this.intent.volume,
          muted: this.intent.muted,
        };
        abort.signal.throwIfAborted();
        const attempt = new AbortController();
        this.restoreAttempt = attempt;
        const cancelAttempt = (): void => attempt.abort();
        abort.signal.addEventListener('abort', cancelAttempt, { once: true });
        let imageVerified = false;
        try {
          await this.original.restore(
            restoredTime,
            { ...restoredControls, playing: false },
            attempt.signal,
          );
          imageVerified = true;
        } catch (error) {
          // Superseded seek/settings cancellation is not failure of the latest
          // request. The global deadline/cancellation still retains ownership.
          if (
            abort.signal.aborted ||
            !attempt.signal.aborted ||
            revision === this.recoveryRevision
          )
            throw error;
        } finally {
          abort.signal.removeEventListener('abort', cancelAttempt);
          if (this.restoreAttempt === attempt) this.restoreAttempt = null;
        }
        abort.signal.throwIfAborted();
        if (this.isPreviewing()) return;
        if (imageVerified && !attempt.signal.aborted) {
          // Drain and the original port's source/settings/paused-image checks
          // have completed. Show that image and its confirmed clock, while
          // retaining ownership and the latest requested target separately.
          this.update({
            time: restoredTime,
            originalPreviewTime: restoredTime,
          });
          abort.signal.throwIfAborted();
        }
        if (revision !== this.recoveryRevision) continue;
        // React may flush an outstanding observation effect while committing
        // the recovered inputs. Publish the same stopped anchor first.
        this.update({ time: restoredTime });
        this.original.restored?.(restoredTime, restoredControls);
        // A synchronous UI commit can unmount or issue a newer operation.
        // Neither grants permission to release the superseded recovery.
        abort.signal.throwIfAborted();
        if (revision === this.recoveryRevision) break;
      }
      // Update the shared clock/settings before releasing the HTML lease; only
      // the latest explicit playing intent may resume after verified recovery.
      this.update({ phase: 'original', time: restoredTime });
      this.original.release();
    } catch (error) {
      reportNativeFailure(
        this.api,
        this.owner,
        this.intent,
        this.state.time,
        2,
        error,
      );
      this.update({ phase: 'failed', error: 'NATIVE_RECOVERY_UNCONFIRMED' });
      throw Error('NATIVE_RECOVERY_UNCONFIRMED');
    } finally {
      clearTimeout(deadline);
    }
  }
}
