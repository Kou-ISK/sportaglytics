import { resolveH264Encoder } from './mediaTools';
import { runMediaProcess } from './ipc/mediaProcessRunner';

export const WINDOWS_H264_UNAVAILABLE =
  'Windows の H.264 動画エンコーダーを利用できません。Windows N では「設定 → アプリ → オプション機能」から Media Feature Pack を追加し、Windows を再起動してください。通常版では Windows のメディア機能とアプリのインストールを確認してください。';

/** Probe real frames: -encoders only reports compile-time support, even on N. */
export const createWindowsH264Check = (
  run: typeof runMediaProcess = runMediaProcess,
): ((executable: string, platform?: NodeJS.Platform) => Promise<void>) => {
  const checks = new Map<string, Promise<void>>();
  return async (executable, platform = process.platform): Promise<void> => {
    if (platform !== 'win32') return;
    let pending = checks.get(executable);
    if (!pending) {
      pending = (async (): Promise<void> => {
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
            { timeoutMs: 15000, maxOutputBytes: 64 * 1024 },
          );
          if (!/^frame=3\r?$/m.test(result.stdout))
            throw new Error('H.264 probe did not encode three frames');
        } catch {
          // Do not expose local paths or raw process diagnostics to the renderer.
          throw new Error(WINDOWS_H264_UNAVAILABLE);
        }
      })();
      checks.set(executable, pending);
    }
    try {
      await pending;
    } catch (error) {
      // Failed probes can be retried after the OS feature is repaired.
      if (checks.get(executable) === pending) checks.delete(executable);
      throw error;
    }
  };
};

export const ensureWindowsH264Encoder = createWindowsH264Check();
