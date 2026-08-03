import { spawn } from 'node:child_process';

interface MediaProcessOptions {
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface MediaProcessResult {
  stdout: string;
  stderr: string;
}

const terminate = (child: ReturnType<typeof spawn>): void => {
  if (child.killed) return;
  child.kill('SIGKILL');
};

export const runMediaProcess = (
  executable: string,
  args: readonly string[],
  options: MediaProcessOptions,
): Promise<MediaProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;

    const finishError = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      terminate(child);
      reject(error);
    };
    const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > options.maxOutputBytes) {
        finishError(new Error('Media process output limit exceeded'));
        return;
      }
      if (target === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };

    const timer = setTimeout(() => {
      finishError(new Error('Media process timed out'));
    }, options.timeoutMs);
    timer.unref();

    child.stdout.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));
    child.once('error', finishError);
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(`Media process failed (${code ?? 'unknown'}): ${stderr}`),
      );
    });
  });
