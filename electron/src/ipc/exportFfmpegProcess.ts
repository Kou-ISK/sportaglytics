import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
import { H264_ENCODER_ARGS } from '../mediaTools';

export const MAX_FFMPEG_STDERR_BYTES = 64 * 1024;

export interface FfmpegProcessProgressOptions {
  durationSeconds: number;
  onProgress: (progress: number) => void;
}

export interface FfmpegExecutionErrorDetails {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderrTail: string;
  executablePath: string;
  commandSummary: string;
}

export class FfmpegExecutionError extends Error {
  public readonly details: FfmpegExecutionErrorDetails;

  public constructor(details: FfmpegExecutionErrorDetails) {
    const status = details.signal
      ? `terminated by ${details.signal}`
      : `exited with code ${details.exitCode ?? 'unknown'}`;
    super(`ffmpeg ${status}`);
    this.name = 'FfmpegExecutionError';
    this.details = details;
  }
}

const buildCommandSummary = (executablePath: string, args: string[]): string => {
  const executableName = path.basename(executablePath);
  const redactedArgs = args.map((arg) => (arg.startsWith('-') ? arg : '<value>'));
  return `${executableName} ${redactedArgs.join(' ')}`.slice(0, 1024);
};

export const parseFfmpegProgressLine = (
  line: string,
  durationSeconds: number,
): number | null => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const separatorIndex = line.indexOf('=');
  if (separatorIndex < 0) return null;
  const key = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1).trim();
  if (key === 'progress' && value === 'end') return 1;
  if (key !== 'out_time_us' && key !== 'out_time_ms') return null;
  const microseconds = Number(value);
  if (!Number.isFinite(microseconds) || microseconds < 0) return null;
  return Math.min(1, microseconds / 1_000_000 / durationSeconds);
};

export const runFfmpegProcess = (
  getFfmpegPath: () => string,
  args: string[],
  progressOptions?: FfmpegProcessProgressOptions,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const ffmpegArgs = progressOptions
      ? ['-progress', 'pipe:1', '-nostats', ...args]
      : args;
    const executablePath = getFfmpegPath();
    const commandSummary = buildCommandSummary(executablePath, ffmpegArgs);
    const ff = spawn(executablePath, ffmpegArgs, {
      shell: false,
      windowsHide: true,
    });
    const timeout = setTimeout(() => ff.kill('SIGKILL'), 6 * 60 * 60 * 1000);
    timeout.unref();
    let progressBuffer = '';
    let lastProgress = -1;
    let stderrTail = Buffer.alloc(0);

    const appendStderr = (data: Buffer): void => {
      stderrTail = Buffer.concat([stderrTail, data]);
      if (stderrTail.byteLength > MAX_FFMPEG_STDERR_BYTES) {
        stderrTail = stderrTail.subarray(-MAX_FFMPEG_STDERR_BYTES);
      }
    };

    const buildError = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): FfmpegExecutionError =>
      new FfmpegExecutionError({
        exitCode,
        signal,
        stderrTail: stderrTail.toString('utf8').trim(),
        executablePath,
        commandSummary,
      });

    ff.stdout.on('data', (data) => {
      if (!progressOptions) return;
      progressBuffer += data.toString();
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const progress = parseFfmpegProgressLine(
          line,
          progressOptions.durationSeconds,
        );
        if (progress === null || progress <= lastProgress) continue;
        lastProgress = progress;
        progressOptions.onProgress(progress);
      }
    });
    ff.stderr.on('data', (data) => {
      appendStderr(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
    ff.once('error', (error) => {
      clearTimeout(timeout);
      const executionError = buildError(null, null);
      console.error('[ffmpeg] failed to start', executionError.details, error);
      reject(executionError);
    });
    ff.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        if (progressOptions && lastProgress < 1) {
          progressOptions.onProgress(1);
        }
        resolve();
      } else {
        const executionError = buildError(code, signal);
        console.error('[ffmpeg] process failed', executionError.details);
        reject(executionError);
      }
    });
  });
};

export const concatFfmpegFiles = async (
  getFfmpegPath: () => string,
  files: string[],
  outputPath: string,
  progressOptions?: FfmpegProcessProgressOptions,
): Promise<void> => {
  const listPath = path.join(
    os.tmpdir(),
    `concat_${Date.now()}_${Math.random()}.txt`,
  );
  const content = files
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fs.writeFile(listPath, content, 'utf-8');

  try {
    await runFfmpegProcess(
      getFfmpegPath,
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-fflags',
        '+genpts',
        ...H264_ENCODER_ARGS,
        '-c:a',
        'aac',
        outputPath,
      ],
      progressOptions,
    );
  } finally {
    await fs.unlink(listPath).catch(() => undefined);
  }
};
