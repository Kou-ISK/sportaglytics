type BufferEvent = 'updateend' | 'error' | 'abort';

export interface RangeSourceBufferPort {
  readonly updating: boolean;
  addEventListener: (event: BufferEvent, listener: () => void) => void;
  removeEventListener: (event: BufferEvent, listener: () => void) => void;
  abort: () => void;
}

interface OwnedOperation {
  terminal: boolean;
  abortIssued: boolean;
  failure: Error | null;
  finish: (sourceClosed?: boolean) => void;
  cancel: () => void;
}

/** One SourceBuffer operation owns its event stream until updateend/sourceclose.
 * Error, cancellation and deadline do not grant ownership to a replacement. */
export class SourceBufferTaskQueue {
  private operation: OwnedOperation | null = null;
  private failed: Error | null = null;
  private closed = false;
  private idleWaiters = new Set<() => void>();

  constructor(
    private readonly buffer: RangeSourceBufferPort,
    private readonly onFailure: (error: Error) => void,
    private readonly deadlineMs = 15000,
  ) {}

  get pending(): boolean {
    return this.operation !== null;
  }

  get failure(): Error | null {
    return this.failed;
  }

  private report(error: Error): void {
    if (this.failed) return;
    this.failed = error;
    try {
      this.onFailure(error);
    } catch {
      // Observer failure cannot release ownership or suppress deadline settlement.
    }
  }

  run(action: () => void, signal: AbortSignal): Promise<void> {
    if (this.closed || this.failed || this.operation || this.buffer.updating)
      return Promise.reject(Error('RANGE_BUFFER_UNAVAILABLE'));
    if (signal.aborted) return Promise.reject(Error('RANGE_BUFFER_CANCELLED'));
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (error: Error | null): void => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
      const release = (): void => {
        clearTimeout(timer);
        for (const event of ['updateend', 'error', 'abort'] as const)
          this.buffer.removeEventListener(event, listeners[event]);
        signal.removeEventListener('abort', operation.cancel);
        if (this.operation === operation) this.operation = null;
        for (const notify of this.idleWaiters) notify();
        this.idleWaiters.clear();
      };
      const markFailure = (error: Error): void => {
        operation.failure ??= error;
        this.report(error);
      };
      const operation: OwnedOperation = {
        terminal: false,
        abortIssued: false,
        failure: null,
        finish: (sourceClosed = false): void => {
          if (operation.terminal) return;
          if (!sourceClosed && this.buffer.updating) {
            markFailure(Error('RANGE_BUFFER_INVALID_COMPLETION'));
            return;
          }
          operation.terminal = true;
          release();
          settle(operation.failure);
        },
        cancel: (): void => {
          if (operation.terminal || operation.abortIssued) return;
          markFailure(Error('RANGE_BUFFER_CANCELLED'));
          if (operation.terminal || this.closed) return;
          if (!this.buffer.updating) return;
          operation.abortIssued = true;
          try {
            this.buffer.abort();
          } catch {
            markFailure(Error('RANGE_BUFFER_ABORT_UNCONFIRMED'));
          }
          // abort may set updating=false synchronously, but its terminal event
          // is still queued. Never start another append in that interval.
        },
      };
      const listeners = {
        updateend: (): void => operation.finish(),
        error: (): void => markFailure(Error('RANGE_BUFFER_MEDIA_ERROR')),
        abort: (): void => markFailure(Error('RANGE_BUFFER_ABORTED')),
      };
      this.operation = operation;
      for (const event of ['updateend', 'error', 'abort'] as const)
        this.buffer.addEventListener(event, listeners[event]);
      signal.addEventListener('abort', operation.cancel, { once: true });
      timer = setTimeout(() => {
        const error = Error('RANGE_BUFFER_COMPLETION_UNCONFIRMED');
        markFailure(error);
        settle(error);
        // Keep event ownership: timeout is not an updateend acknowledgement.
      }, this.deadlineMs);
      try {
        action();
      } catch (error) {
        const failure =
          error instanceof Error ? error : Error('RANGE_BUFFER_ACTION_FAILED');
        markFailure(failure);
        // A thrown synchronous action that did not start native work is known
        // complete. An updating buffer still owns the failed operation.
        if (!this.buffer.updating) operation.finish();
      }
    });
  }

  cancel(): void {
    this.operation?.cancel();
  }

  /** The MediaSource's actual sourceclose, not a requested URL change. */
  sourceClosed(): void {
    this.closed = true;
    const operation = this.operation;
    if (!operation) return;
    operation.failure ??= Error('RANGE_SOURCE_CLOSED');
    operation.finish(true);
  }

  /** No timeout fabricates completion. Caller may report an unresolved drain. */
  drained(): Promise<void> {
    if (!this.operation) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }
}
