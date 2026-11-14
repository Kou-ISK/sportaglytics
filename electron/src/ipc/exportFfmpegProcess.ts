import { copyWithBudget } from './exportBoundedCopy';
import { exportResourceContext } from './exportResourceContext';
import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { H264_ENCODER_ARGS } from '../mediaTools';
import { ensureWindowsH264Encoder } from '../windowsH264Capability';
import { canConcatenateWithoutEncoding } from './exportStreamCopy';
import { exportAbortContext } from './exportAbortContext';

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
  videoToolboxRequested?: boolean;
}

export class FfmpegExecutionError extends Error {
  public readonly details: FfmpegExecutionErrorDetails;

  public constructor(details: FfmpegExecutionErrorDetails) {
    const status = details.signal
      ? `terminated by ${details.signal}`
      : `exited with code ${details.exitCode ?? 'unknown'}`;
    const encoderUnavailable = details.videoToolboxRequested === true && details.exitCode !== null && details.exitCode !== 0 && details.signal === null &&
      /^\[h264_videotoolbox[ \t]+@[^\]\r\n]+\][ \t]+Error:[ \t]*cannot create compression session:[ \t]*-12908\r?$/im.test(details.stderrTail);
    super(encoderUnavailable
      ? `H.264 エンコーダーを利用できない可能性があります（VideoToolbox -12908; ffmpeg ${status}）`
      : `ffmpeg ${status}`);
    this.name = 'FfmpegExecutionError';
    this.details = details;
  }
}

const buildCommandSummary = (
  executablePath: string,
  args: string[],
): string => {
  const executableName = path.basename(executablePath);
  const redactedArgs = args.map((arg) =>
    arg.startsWith('-') ? arg : '<value>',
  );
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

export const runFfmpegProcess = async (
  getFfmpegPath: () => string,
  args: string[],
  progressOptions?: FfmpegProcessProgressOptions,
  abortSignal?: AbortSignal,
): Promise<void> => {
  abortSignal ??= exportAbortContext.getStore();
  abortSignal?.throwIfAborted();
  const executablePath = getFfmpegPath();
  if (args.includes('h264_mf'))
    await ensureWindowsH264Encoder(
      executablePath,
      process.platform,
      abortSignal,
    );
  abortSignal?.throwIfAborted();
  const jobResources = exportResourceContext.getStore();
  await jobResources?.check();
  abortSignal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const ffmpegArgs = progressOptions
      ? ['-progress', 'pipe:1', '-nostats', ...args]
      : args;
    const commandSummary = buildCommandSummary(executablePath, ffmpegArgs);
    const ff = spawn(executablePath, ffmpegArgs, {
      shell: false,
      windowsHide: true,
    });
    console.info('[export] FFmpeg started', {
      operation: args.includes('copy') ? 'stream-copy' : 'encode',
      durationSeconds: progressOptions?.durationSeconds,
    });
    const timeout = setTimeout(() => ff.kill('SIGKILL'), 6 * 60 * 60 * 1000);
    timeout.unref();
    let killTimer: NodeJS.Timeout | undefined;
    let resourceFailure: Error | undefined;
    let inspection: Promise<void> | undefined;
    const resources = jobResources;
    let childClosed = false;
    const outputPath = args[args.length - 1];
    const abort = (): void => {
      ff.kill('SIGTERM');
      killTimer ??= setTimeout(() => ff.kill('SIGKILL'), 2000);
      killTimer.unref();
    };
    const inspect = async (allowMissing = true): Promise<void> => {
      if (!resources || !outputPath) return;
      await resources.check();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const st = await Promise.race([
          fs.lstat(outputPath),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('容量監視がタイムアウトしました')), 2000); }),
        ]);
        if (!st.isFile() || st.size > resources.maxFileBytes) throw new Error('書き出しの容量上限を超えました');
      } catch (error) {
        if (!(allowMissing && error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
      } finally { if (timer) clearTimeout(timer); }
    };
    const monitor = resources && outputPath ? setInterval(() => {
      if (inspection || resourceFailure) return;
      inspection = inspect().catch((error: unknown) => {
        if (!abortSignal?.aborted) {
          resourceFailure = error instanceof Error ? error : new Error('容量の監視に失敗しました');
          if (!childClosed) abort();
        }
      }).finally(() => { inspection = undefined; });
    }, 250) : undefined;
    monitor?.unref();
    abortSignal?.addEventListener('abort', abort, { once: true });
    if (abortSignal?.aborted) abort();
    const cleanup = (): void => {
      clearTimeout(timeout);
      if (monitor) clearInterval(monitor);
      if (killTimer) clearTimeout(killTimer);
      abortSignal?.removeEventListener('abort', abort);
    };
    let progressBuffer = '';
    let lastProgress = -1;
    let stderrTail = Buffer.alloc(0);
    let childError: Error | undefined;

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
        videoToolboxRequested: args.some((arg, index) => (arg === '-c:v' || arg === '-codec:v') && args[index + 1] === 'h264_videotoolbox'),
      });

    ff.stdout.on('data', (data) => {
      if (!progressOptions || abortSignal?.aborted) return;
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
      if (ff.pid !== undefined) {
        childError = error;
        return;
      }
      cleanup();
      if (abortSignal?.aborted) {
        reject(abortSignal.reason);
        return;
      }
      const executionError = buildError(null, null);
      console.error('[ffmpeg] failed to start', executionError.details, error);
      reject(executionError);
    });
    ff.on('close', async (code, signal) => {
      childClosed = true;
      cleanup();
      await inspection;
      if (!resourceFailure && !abortSignal?.aborted && code === 0) {
        try { await inspect(false); } catch (error) { resourceFailure = error instanceof Error ? error : new Error('容量の監視に失敗しました'); }
      }
      if (resourceFailure) {
        reject(resourceFailure);
        return;
      }
      if (abortSignal?.aborted) {
        reject(abortSignal.reason);
        return;
      }
      if (childError) {
        reject(childError);
        return;
      }
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
  if (files.length === 1) {
    // The rendered clip is already final; do not encode a long match again just to rename it.
    const resources = exportResourceContext.getStore();
    if (resources) {
      await copyWithBudget(files[0], outputPath, { maxBytes: resources.maxFileBytes, minimumFreeBytes: resources.minFreeBytes, signal: resources.signal });
    } else {
      await fs.copyFile(files[0], outputPath, constants.COPYFILE_EXCL);
    }
    progressOptions?.onProgress(1);
    return;
  }
  const listPath = path.join(
    os.tmpdir(),
    `concat_${Date.now()}_${Math.random()}.txt`,
  );
  const content = files
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fs.writeFile(listPath, content, 'utf-8');

  try {
    const streamCopy = await canConcatenateWithoutEncoding(files);
    await runFfmpegProcess(
      getFfmpegPath,
      [
        '-n',
        // Keep the concat demuxer clock: AAC priming must not shift the video origin.
        ...(streamCopy ? ['-copyts'] : []),
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-fflags',
        '+genpts',
        ...(streamCopy
          ? ['-c', 'copy', '-avoid_negative_ts', 'disabled']
          : [...H264_ENCODER_ARGS, '-c:a', 'aac']),
        outputPath,
      ],
      progressOptions,
    );
  } finally {
    await fs.unlink(listPath).catch(() => undefined);
  }
};
