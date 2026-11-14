import { fstatSync } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { spawn } from 'node:child_process';
import { lstat, statfs } from 'node:fs/promises';
import path from 'node:path';
import { createControlPipe } from '../nativePlayback/runtime/support/control-pipe.cjs';
import type { ControlPipe } from '../nativePlayback/runtime/support/control-pipe.cjs';

export class NativeExportCancelled extends Error {
  constructor() {
    super('Native export cancelled');
    this.name = 'AbortError';
  }
}

/** A terminal resource failure: never retry automatically using another encoder. */
export class NativeExportCapacityError extends Error {
  constructor(message: string) { super(message); this.name = 'NativeExportCapacityError'; }
}

const MIN_FREE_BYTES = 2 * 1024 ** 3;
const withInspectionDeadline = async <T>(operation: Promise<T>): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new NativeExportCapacityError('容量の確認がタイムアウトしました')), 2000);
    })]);
  } finally { if (timeout) clearTimeout(timeout); }
};
export const checkNativeExportFreeSpace = async (directories: string[], minimumFreeBytes = MIN_FREE_BYTES): Promise<void> => {
  if (!Number.isSafeInteger(minimumFreeBytes) || minimumFreeBytes < MIN_FREE_BYTES) throw new NativeExportCapacityError('Invalid free-space reserve');
  await Promise.all([...new Set(directories)].map(async (directory) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const volume = await Promise.race([
        statfs(directory),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new NativeExportCapacityError('空き容量の確認がタイムアウトしました')), 2000);
        }),
      ]);
      const available = volume.bavail * volume.bsize;
      if (!Number.isFinite(available) || available < minimumFreeBytes)
        throw new NativeExportCapacityError('書き出しに必要な空き容量を確保できません');
    } catch (error) {
      if (error instanceof NativeExportCapacityError) throw error;
      throw new NativeExportCapacityError('書き出し中の空き容量を確認できません');
    } finally { if (timeout) clearTimeout(timeout); }
  }));
};

interface NativeExportProcessOptions {
  onControlIdentity?: (stat: BigIntStats) => void;
  signal?: AbortSignal;
  outputPath?: string;
  maxOutputBytes?: number;
  reserveDirectories?: string[];
  timeoutMs?: number;
  minimumFreeBytes?: number;
}

interface ChildOptions extends NativeExportProcessOptions {
  control?: ControlPipe;
  sourceFd?: number;
  timeoutMs: number;
  stdoutLimit: number;
}

/** Cancellation is terminal only after child close; a timeout is never a drain receipt. */
const runExportChild = (
  executable: string,
  args: string[],
  options: ChildOptions,
): Promise<string> =>
  new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new NativeExportCancelled());
      return;
    }
    if (options.sourceFd !== undefined && (!Number.isSafeInteger(options.sourceFd) || options.sourceFd < 3)) {
      reject(new Error('Invalid source descriptor'));
      return;
    }
    const child = spawn(executable, args, {
      shell: false,
      stdio: [options.control?.inputFd ?? 'ignore', 'pipe', 'pipe', ...(options.sourceFd === undefined ? [] : [options.sourceFd])],
    });
    let stdout = '';
    let bytes = 0;
    let failure: Error | null = null;
    let closed = false;
    let inspection: Promise<void> | undefined;
    const { outputPath, maxOutputBytes } = options;
    let forcedStop: ReturnType<typeof setTimeout> | undefined;
    const stop = (error: Error): void => {
      if (failure) return;
      failure = error;
      if (closed) return;
      // The helper observes EOF, cancels AVFoundation and exits. Escalation is
      // bounded to this owned helper; ownership still ends only on child close.
      if (options.control) {
        void options.control.close().catch((error: unknown) => {
          if (!failure) failure = error instanceof Error ? error : Error('Native export pipe close failed');
        });
      } else child.kill('SIGTERM');
      forcedStop = setTimeout(() => child.kill('SIGKILL'), 2000);
      forcedStop.unref();
    };
    const abort = (): void => stop(new NativeExportCancelled());
    options.signal?.addEventListener('abort', abort, { once: true });
    const inspect = async (): Promise<void> => {
      if (!outputPath || !maxOutputBytes) return;
      const size = withInspectionDeadline(lstat(outputPath)).then((value) => {
        if (!value.isFile() || value.size > maxOutputBytes) stop(new NativeExportCapacityError('書き出しの容量上限を超えました'));
      }).catch((error: unknown) => {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) stop(new NativeExportCapacityError('書き出し中の容量を確認できません'));
      });
      const space = checkNativeExportFreeSpace([path.dirname(outputPath), ...(options.reserveDirectories ?? [])], options.minimumFreeBytes).catch((error: unknown) => {
        stop(error instanceof NativeExportCapacityError ? error : new NativeExportCapacityError('書き出し中の空き容量を確認できません'));
      });
      await Promise.all([size, space]);
    };
    const sizeCheck = setInterval(() => {
      if (!outputPath || !maxOutputBytes || inspection || closed) return;
      inspection = inspect().finally(() => { inspection = undefined; });
    }, 250);
    sizeCheck.unref();
    const timer = setTimeout(
      () => stop(Error('Native export deadline')),
      options.timeoutMs,
    );
    timer.unref();
    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.stdoutLimit)
        stop(Error('Native export output limit'));
      else stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.stdoutLimit)
        stop(Error('Native export output limit'));
    });
    child.once('error', (error) => {
      failure ??= error;
    });
    child.once('close', (code, signal) => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(forcedStop);
      clearInterval(sizeCheck);
      options.signal?.removeEventListener('abort', abort);
      void (async () => {
        await inspection;
        if (!failure) await inspect();
        if (failure) reject(failure);
        else if (code !== 0 || signal) reject(Object.assign(Error('Native export process failed'), { exitCode: code, signal }));
        else resolve(stdout);
      })();
    });
    try {
      options.control?.closeReader();
    } catch (error) {
      stop(
        error instanceof Error
          ? error
          : Error('Native export reader close failed'),
      );
    }
  });

/** Node/libuv stdio "pipe" is a socket on macOS. Reuse the existing owned
 * mode-0600 FIFO instead of weakening the helper's physical transport guard. */
export const runNativeExportProcess = async (
  executable: string,
  requestPath: string,
  options: NativeExportProcessOptions = {},
): Promise<string> => {
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 11000 || options.timeoutMs > 610000)) throw new Error('Invalid native deadline');
  if (options.signal?.aborted) throw new NativeExportCancelled();
  if (options.outputPath) {
    await checkNativeExportFreeSpace([path.dirname(options.outputPath), ...(options.reserveDirectories ?? [])], options.minimumFreeBytes);
    if (options.signal?.aborted) throw new NativeExportCancelled();
  }
  const control = createControlPipe(
    path.join(path.dirname(requestPath), 'control.fifo'),
  );
  let failed = false;
  try {
    if (options.onControlIdentity) options.onControlIdentity(fstatSync(control.inputFd, { bigint: true }));
    return await runExportChild(executable, ['--export-clip', requestPath], {
      ...options,
      control,
      timeoutMs: options.timeoutMs ?? 120000,
      stdoutLimit: 64 * 1024,
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try { await control.close(); } catch (error) { if (!failed) throw error; }
  }
};

/** Metadata reads share cancellation and actual-close ownership with export. */
export const runNativeExportProbe = (
  executable: string,
  args: string[],
  signal?: AbortSignal,
  sourceFd?: number,
): Promise<string> =>
  runExportChild(executable, args, {
    signal,
    sourceFd,
    timeoutMs: 30000,
    stdoutLimit: 1024 * 1024,
  });

/** The caller must verify the resource before invoking this bounded probe. */
export const runNativeCapabilityProbe = (executable: string, signal?: AbortSignal): Promise<string> =>
  runExportChild(executable, ['--clip-export-capabilities'], { signal, timeoutMs: 5000, stdoutLimit: 1024 });
