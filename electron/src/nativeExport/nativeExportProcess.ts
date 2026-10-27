import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { createControlPipe } from '../nativePlayback/runtime/support/control-pipe.cjs';
import type { ControlPipe } from '../nativePlayback/runtime/support/control-pipe.cjs';

export class NativeExportCancelled extends Error {
  constructor() {
    super('Native export cancelled');
    this.name = 'AbortError';
  }
}

interface NativeExportProcessOptions {
  signal?: AbortSignal;
  outputPath?: string;
  maxOutputBytes?: number;
}

interface ChildOptions extends NativeExportProcessOptions {
  control?: ControlPipe;
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
    const child = spawn(executable, args, {
      shell: false,
      stdio: [options.control?.inputFd ?? 'ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let bytes = 0;
    let failure: Error | null = null;
    let closed = false;
    let checking = false;
    const { outputPath, maxOutputBytes } = options;
    let forcedStop: ReturnType<typeof setTimeout> | undefined;
    const stop = (error: Error): void => {
      if (closed || failure) return;
      failure ??= error;
      // The helper observes EOF, cancels AVFoundation and exits. Escalation is
      // bounded to this owned helper; ownership still ends only on child close.
      if (options.control) {
        void options.control.close().catch((error: unknown) => {
          failure =
            error instanceof Error
              ? error
              : Error('Native export pipe close failed');
        });
      } else child.kill('SIGTERM');
      forcedStop = setTimeout(() => child.kill('SIGKILL'), 2000);
      forcedStop.unref();
    };
    const abort = (): void => stop(new NativeExportCancelled());
    options.signal?.addEventListener('abort', abort, { once: true });
    const sizeCheck = setInterval(() => {
      if (!outputPath || !maxOutputBytes || checking || closed) return;
      checking = true;
      void lstat(outputPath)
        .then((stat) => {
          if (!closed && (!stat.isFile() || stat.size > maxOutputBytes))
            stop(Error('Native export file limit'));
        })
        .catch((error: unknown) => {
          if (
            !closed &&
            !(
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 'ENOENT'
            )
          )
            stop(Error('Native export file inspection failed'));
        })
        .finally(() => {
          checking = false;
        });
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
      if (failure) reject(failure);
      else if (code !== 0 || signal)
        reject(Error('Native export process failed'));
      else resolve(stdout);
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
  if (options.signal?.aborted) throw new NativeExportCancelled();
  const control = createControlPipe(
    path.join(path.dirname(requestPath), 'control.fifo'),
  );
  try {
    return await runExportChild(executable, ['--export-clip', requestPath], {
      ...options,
      control,
      timeoutMs: 120000,
      stdoutLimit: 64 * 1024,
    });
  } finally {
    await control.close();
  }
};

/** Metadata reads share cancellation and actual-close ownership with export. */
export const runNativeExportProbe = (
  executable: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> =>
  runExportChild(executable, args, {
    signal,
    timeoutMs: 30000,
    stdoutLimit: 1024 * 1024,
  });
