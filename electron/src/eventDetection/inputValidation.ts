import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import type { EventDetectionClipInput } from '../../../src/types/eventDetection/core';

/** Check every source before starting a potentially long model run. */
export const validateEventDetectionClips = async (
  clips: EventDetectionClipInput[],
): Promise<void> => {
  await Promise.all(
    clips.map(async ({ videoPath }) => {
      let isFile: boolean;
      try {
        isFile = (await stat(videoPath)).isFile();
        if (isFile) await access(videoPath, constants.R_OK);
      } catch (error: unknown) {
        const missing =
          error instanceof Error &&
          'code' in error &&
          (error.code === 'ENOENT' || error.code === 'ENOTDIR');
        throw new Error(
          missing
            ? `解析する映像ファイルが見つかりません。ファイルの移動・削除や保存先ドライブの接続を確認し、パッケージを開き直してください。\n対象: ${videoPath}`
            : `解析する映像ファイルを読み取れません。ファイルのアクセス権と保存先ドライブを確認してください。\n対象: ${videoPath}`,
        );
      }
      if (!isFile) {
        throw new Error(
          `解析対象が映像ファイルではありません。パッケージの映像設定を確認してください。\n対象: ${videoPath}`,
        );
      }
    }),
  );
};
