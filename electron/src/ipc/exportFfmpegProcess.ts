import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';

export const runFfmpegProcess = (
  getFfmpegPath: () => string,
  args: string[],
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(getFfmpegPath(), args);
    ff.stderr.on('data', (data) => {
      console.log('[ffmpeg]', data.toString());
    });
    ff.on('close', (code) => {
      if (code === 0) {
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
): Promise<void> => {
  const listPath = path.join(
    os.tmpdir(),
    `concat_${Date.now()}_${Math.random()}.txt`,
  );
  const content = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, content, 'utf-8');

  try {
    await runFfmpegProcess(getFfmpegPath, [
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
    ]);
  } finally {
    await fs.unlink(listPath).catch(() => undefined);
  }
};
