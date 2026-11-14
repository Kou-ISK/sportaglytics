import { resolveH264Encoder } from './mediaTools';
import { runMediaProcess } from './ipc/mediaProcessRunner';
import {
  exportProcessContext,
  exportAbortContext,
  trackExportProcess,
} from './ipc/exportAbortContext';

export const WINDOWS_H264_UNAVAILABLE =
  'Windows の H.264 動画エンコーダーを利用できません。Windows N では「設定 → アプリ → オプション機能」から Media Feature Pack を追加し、Windows を再起動してください。通常版では Windows のメディア機能とアプリのインストールを確認してください。';

/** Probe real frames: -encoders only reports compile-time support, even on N. */
export const createWindowsH264Check = (
  run: typeof runMediaProcess = runMediaProcess,
): ((
  executable: string,
  platform?: NodeJS.Platform,
  signal?: AbortSignal,
) => Promise<void>) => {
  type Check = {
    promise: Promise<void>;
    controller: AbortController;
    waiters: number;
    settled: boolean;
  };
  const checks = new Map<string, Check>();
  return async (
    executable,
    platform = process.platform,
    signal,
  ): Promise<void> => {
    if (platform !== 'win32') return;
    signal?.throwIfAborted();
    let pending = checks.get(executable);
    if (!pending) {
      const controller = new AbortController();
      const entry: Check = {
        controller,
        promise: Promise.resolve(),
        waiters: 0,
        settled: false,
      };
      const runProbe = async (): Promise<void> => {
        try {
          const result = await run(
            executable,
            [
              '-hide_banner',
              '-v',
              'error',
              '-nostdin',
              '-f',
              'lavfi',
              '-i',
              'color=black:s=320x240:r=30',
              '-frames:v',
              '3',
              '-an',
              ...resolveH264Encoder('win32').args,
              '-progress',
              'pipe:1',
              '-nostats',
              '-f',
              'null',
              '-',
            ],
            {
              timeoutMs: 15000,
              maxOutputBytes: 64 * 1024,
              signal: controller.signal,
            },
          );
          if (!/^frame=3\r?$/m.test(result.stdout))
            throw new Error('H.264 probe did not encode three frames');
        } catch {
          controller.signal.throwIfAborted();
          // Do not expose local paths or raw process diagnostics to the renderer.
          throw new Error(WINDOWS_H264_UNAVAILABLE);
        }
      };
      entry.promise = exportAbortContext
        .exit(() => exportProcessContext.exit(runProbe))
        .then(
          () => {
            entry.settled = true;
          },
          (error) => {
            entry.settled = true;
            if (checks.get(executable) === entry) checks.delete(executable);
            throw error;
          },
        );
      pending = entry;
      checks.set(executable, entry);
    }
    const entry = pending;
    entry.waiters++;
    await trackExportProcess(
      new Promise<void>((resolve, reject) => {
        let done = false;
        let cancelling = false;
        const finish = (error?: unknown): void => {
          if (done) return;
          done = true;
          signal?.removeEventListener('abort', abort);
          entry.waiters--;
          if (error !== undefined) reject(error);
          else if (signal?.aborted) reject(signal.reason);
          else resolve();
        };
        const abort = (): void => {
          if (done) return;
          if (entry.waiters === 1 && !entry.settled) {
            cancelling = true;
            if (checks.get(executable) === entry) checks.delete(executable);
            entry.controller.abort();
            // The last waiter owns shutdown of the shared child and waits for close.
            void entry.promise.then(
              () => finish(signal?.reason),
              () => finish(signal?.reason),
            );
          } else finish(signal?.reason);
        };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        void entry.promise.then(
          () => {
            if (!cancelling) finish();
          },
          (error) => {
            if (!cancelling) finish(error);
          },
        );
      }),
    );
  };
};

export const ensureWindowsH264Encoder = createWindowsH264Check();
