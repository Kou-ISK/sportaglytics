import { spawn } from 'node:child_process';

/** Cancellation is terminal only after child close; a timeout is never a drain receipt. */
export const runNativeExportProcess = (
  executable: string,
  requestPath: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, [requestPath], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let bytes = 0;
    let failure: Error | null = null;
    const stop = (error: Error): void => {
      failure ??= error;
      child.kill('SIGKILL');
    };
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
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0 || signal)
        reject(Error('Native export process failed'));
      else resolve(stdout);
    });
  });
