import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';

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

/** Cancellation is terminal only after child close; a timeout is never a drain receipt. */
export const runNativeExportProcess = (
  executable: string,
  requestPath: string,
  options: NativeExportProcessOptions = {},
): Promise<string> =>
  new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new NativeExportCancelled());
      return;
    }
    const child = spawn(executable, ['--export-clip', requestPath], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
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
      child.stdin.end();
      forcedStop = setTimeout(() => child.kill('SIGKILL'), 2000);
      forcedStop.unref();
    };
    const abort = (): void => stop(new NativeExportCancelled());
    options.signal?.addEventListener('abort', abort, { once: true });
    const sizeCheck = setInterval(() => {
      if (!outputPath || !maxOutputBytes || checking || closed)
        return;
      checking = true;
      void lstat(outputPath)
        .then((stat) => {
          if (
            !closed &&
            (!stat.isFile() || stat.size > maxOutputBytes)
          )
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
      120_000,
    );
    timer.unref();
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) stop(Error('Native export output limit'));
      else stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) stop(Error('Native export output limit'));
    });
    child.once('error', (error) => {
      failure ??= error;
    });
    child.stdin.on('error', (error: Error) => stop(error));
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
  });
