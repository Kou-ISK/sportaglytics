import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface FfmpegProcessProgressOptions {
  durationSeconds: number;
  onProgress: (progress: number) => void;
}

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
    const ff = spawn(getFfmpegPath(), ffmpegArgs);
    let progressBuffer = '';
    let lastProgress = -1;
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
      console.log('[ffmpeg]', data.toString());
    });
    ff.once('error', reject);
    ff.on('close', (code) => {
      if (code === 0) {
        if (progressOptions && lastProgress < 1) {
          progressOptions.onProgress(1);
        }
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
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
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
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
