export interface CacheWorkerEvents {
  output: (stream: 'progress' | 'diagnostic', chunk: Buffer) => void;
  error: (error: Error) => void;
  closed: (code: number | null, signal: string | null) => void;
}

export interface CacheWorker {
  /** Request termination of this owned child only. Never imply exit from true. */
  terminate: () => boolean;
  dispose: () => void;
}

export interface CacheConversionOptions {
  signal: AbortSignal;
  durationSeconds: number;
  timeoutMs: number;
  budgetPollMs: number;
  budgetDeadlineMs: number;
  stopWarningMs: number;
  maximumDiagnosticBytes: number;
  checkBudget: () => Promise<void>;
  progress: (fraction: number) => void;
  /** false = stopping; true = exit still unconfirmed. UI must keep the job busy. */
  stopWaiting: (unconfirmed: boolean) => void;
}

const observe = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // A gone UI cannot change child ownership or unblock cleanup.
  }
};

const checkBudgetWithin = async (
  check: () => Promise<void>,
  deadlineMs: number,
): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('CACHE_BUDGET_UNAVAILABLE')),
          deadlineMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Connects an owned worker to cache storage's budget guard. The Main factory
 * must not throw after creating a child, and must report close even on spawn
 * failure. Completion never settles before close. A stuck child keeps the job
 * busy: no force-kill, automatic retry, publication or staging cleanup. */
export const runCacheConversion = async (
  startWorker: (events: CacheWorkerEvents) => CacheWorker,
  configuration: CacheConversionOptions,
): Promise<void> => {
  const options = { ...configuration };
  const durations = [
    options.timeoutMs,
    options.budgetPollMs,
    options.budgetDeadlineMs,
    options.stopWarningMs,
  ];
  if (
    !Number.isFinite(options.durationSeconds) ||
    options.durationSeconds <= 0 ||
    !durations.every(
      (value) =>
        Number.isSafeInteger(value) && value > 0 && value <= 2147483647,
    ) ||
    !Number.isSafeInteger(options.maximumDiagnosticBytes) ||
    options.maximumDiagnosticBytes < 1
  )
    throw new Error('CACHE_INVALID_WORKER_OPTIONS');
  options.signal.throwIfAborted();
  await checkBudgetWithin(options.checkBudget, options.budgetDeadlineMs);
  options.signal.throwIfAborted();

  await new Promise<void>((resolve, reject) => {
    let worker: CacheWorker | undefined;
    let done = false;
    let failure: Error | null = null;
    let terminationRequested = false;
    let progressBuffer = '';
    let lastProgress = 0;
    let diagnosticBytes = 0;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    const requestStop = (reason: Error): void => {
      if (done) return;
      failure ??= reason;
      if (terminationRequested || !worker) return;
      terminationRequested = true;
      clearTimeout(deadline);
      clearTimeout(budgetTimer);
      observe(() => options.stopWaiting(false));
      stopTimer = setTimeout(
        () => observe(() => options.stopWaiting(true)),
        options.stopWarningMs,
      );
      try {
        if (!worker.terminate()) observe(() => options.stopWaiting(true));
      } catch {
        observe(() => options.stopWaiting(true));
      }
    };
    const aborted = (): void => requestStop(new Error('CACHE_CANCELLED'));
    options.signal.addEventListener('abort', aborted, { once: true });

    const pollBudget = async (): Promise<void> => {
      try {
        await checkBudgetWithin(options.checkBudget, options.budgetDeadlineMs);
      } catch (error) {
        if (!done)
          requestStop(
            error instanceof Error ? error : new Error('CACHE_CAPACITY'),
          );
      }
      // Single in-flight read; a stalled/late read never starts a second poll.
      if (!done && !failure)
        budgetTimer = setTimeout(() => void pollBudget(), options.budgetPollMs);
    };
    const output = (stream: 'progress' | 'diagnostic', chunk: Buffer): void => {
      if (done || failure) return;
      if (stream === 'diagnostic') {
        diagnosticBytes += chunk.byteLength;
        if (diagnosticBytes > options.maximumDiagnosticBytes)
          requestStop(new Error('CACHE_DIAGNOSTIC_LIMIT'));
        return;
      }
      // FFmpeg progress uses ASCII key=value lines. Bound pending text without
      // retaining media paths or growing logs for a multi-hour conversion.
      if (chunk.byteLength > 65536) {
        requestStop(new Error('CACHE_PROGRESS_LIMIT'));
        return;
      }
      for (const part of chunk.toString('utf8').split(/(?<=\n)/)) {
        if (done || failure) return;
        progressBuffer += part;
        if (Buffer.byteLength(progressBuffer) > 4096) {
          requestStop(new Error('CACHE_PROGRESS_LIMIT'));
          return;
        }
        if (!progressBuffer.endsWith('\n')) continue;
        const match = /^out_time_us=(\d+)\r?\n$/.exec(progressBuffer);
        progressBuffer = '';
        if (!match) continue;
        const microseconds = Number(match[1]);
        if (!Number.isSafeInteger(microseconds)) continue;
        lastProgress = Math.max(
          lastProgress,
          Math.min(0.999, microseconds / 1e6 / options.durationSeconds),
        );
        observe(() => options.progress(lastProgress));
      }
    };
    const finish = (code: number | null, signal: string | null): void => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(budgetTimer);
      clearTimeout(stopTimer);
      options.signal.removeEventListener('abort', aborted);
      observe(() => worker?.dispose());
      if (failure) reject(failure);
      else if (code !== 0 || signal) reject(new Error('CACHE_WORKER_FAILED'));
      else {
        observe(() => options.progress(1));
        resolve();
      }
    };
    try {
      worker = startWorker({ output, error: requestStop, closed: finish });
    } catch (error) {
      // The factory contract guarantees no owned process exists on sync throw.
      failure =
        error instanceof Error ? error : new Error('CACHE_SPAWN_FAILED');
      finish(null, null);
      return;
    }
    if (done) {
      observe(() => worker?.dispose());
      return;
    }
    if (options.signal.aborted) aborted();
    if (failure) requestStop(failure);
    else {
      deadline = setTimeout(
        () => requestStop(new Error('CACHE_CONVERSION_TIMEOUT')),
        options.timeoutMs,
      );
      budgetTimer = setTimeout(() => void pollBudget(), options.budgetPollMs);
    }
  });
};
