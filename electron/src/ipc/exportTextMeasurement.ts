import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MeasureClipText } from '../../../src/shared/clipExport/clipExportTextLayout';
import { runMediaProcess } from './mediaProcessRunner';
import { escapeFilterOption } from './ffmpegFilterEscaping';
import { exportAbortContext } from './exportAbortContext';

interface Measurement {
  text: string;
  isBold: boolean;
  fontSize: number;
  resolve: (width: number) => void;
  reject: (error: Error) => void;
}

const failure = (): Error =>
  new Error('書き出しテキストの文字幅を測定できません');

/** A request-scoped cache and bounded batches; no user text in argv or logs. */
export const createClipTextMeasurer = (
  getFfmpegPath: () => string,
  getFontPath: (isBold?: boolean) => string,
): MeasureClipText => {
  const cache = new Map<string, Promise<number>>();
  let cacheBytes = 0;
  const queue: Measurement[] = [];
  let running = false;
  const signal = exportAbortContext.getStore();

  const flush = async (): Promise<void> => {
    running = true;
    while (queue.length) {
      const batch = queue.splice(0, 32);
      let directory: string | undefined;
      try {
        directory = await fs.mkdtemp(
          path.join(os.tmpdir(), 'sportaglytics-text-metrics-'),
        );
        const filters = [];
        for (const [index, request] of batch.entries()) {
          const file = path.join(directory, `${index}.txt`);
          await fs.writeFile(file, request.text, { mode: 0o600 });
          const font = escapeFilterOption(
            getFontPath(request.isBold).replace(/\\/g, '/'),
          );
          // print() and text_w are documented FFmpeg expressions. Negative IDs
          // distinguish measurements from unrelated numeric diagnostics; x can
          // be evaluated more than once, so duplicate identical values are valid.
          filters.push(
            `drawtext=fontfile=${font}:textfile=${escapeFilterOption(file.replace(/\\/g, '/'))}:expansion=none:fontsize=${request.fontSize}:x='print(-${index + 1});print(text_w);0':y=0`,
          );
        }
        const result = await runMediaProcess(
          getFfmpegPath(),
          [
            '-hide_banner',
            '-nostdin',
            '-nostats',
            '-loglevel',
            'info',
            '-f',
            'lavfi',
            '-i',
            'color=s=16x16:d=0.04',
            '-vf',
            filters.join(','),
            '-frames:v',
            '1',
            '-f',
            'null',
            '-',
          ],
          { timeoutMs: 10000, maxOutputBytes: 256 * 1024, signal },
        );
        const widths = new Map<number, number>();
        let index: number | undefined;
        for (const line of result.stderr.split(/\r?\n/)) {
          if (!/^-?\d+\.\d+$/.test(line)) {
            index = undefined;
            continue;
          }
          const value = Number(line);
          if (value < 0) {
            index = -value - 1;
            continue;
          }
          if (index === undefined || !batch[index]) throw failure();
          const previous = widths.get(index);
          if (previous !== undefined && previous !== value) throw failure();
          widths.set(index, value);
          index = undefined;
        }
        if (widths.size !== batch.length) throw failure();
        await fs.rm(directory, { recursive: true, force: true });
        directory = undefined;
        batch.forEach((request, index) => request.resolve(widths.get(index)!));
      } catch {
        // FFmpeg diagnostics may contain local font paths. Do not expose them.
        if (directory)
          await fs
            .rm(directory, { recursive: true, force: true })
            .catch(() => undefined);
        batch.forEach((request) => request.reject(failure()));
      }
    }
    running = false;
  };

  return (text, isBold, fontSize) => {
    if (!text) return Promise.resolve(0);
    const key = JSON.stringify([text, isBold, fontSize]);
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = new Promise<number>((resolve, reject) => {
      queue.push({ text, isBold, fontSize, resolve, reject });
      if (!running) {
        running = true;
        setImmediate(() => {
          void flush();
        });
      }
    });
    // Bound retained note content even for large multi-clip inspections.
    if (cache.size >= 2048 || cacheBytes + key.length * 2 > 1024 * 1024) {
      cache.clear();
      cacheBytes = 0;
    }
    cache.set(key, pending);
    cacheBytes += key.length * 2;
    return pending;
  };
};
