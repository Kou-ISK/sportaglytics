import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ExportClipsPayload } from './exportHandlers.types';
import {
  getClipExportSources,
  resolveExportSourceSelection,
} from './exportSourceSelection';
import { planExportSource } from './exportVirtualTimelineSource';
import type { ExportSourcePlan } from './exportVirtualTimelineSource';

/** Read-only batch check: finish every source check before any video is encoded. */
export const preflightClipExport = async (
  payload: ExportClipsPayload,
  outputDir: string,
): Promise<ExportSourcePlan[]> => {
  const selection = resolveExportSourceSelection(payload);
  const problems = new Set<string>();
  const requestedSources = new Set<string>();
  for (const [index, clip] of payload.clips.entries()) {
    if (
      !Number.isFinite(clip.startTime) ||
      !Number.isFinite(clip.endTime) ||
      clip.startTime < 0 ||
      clip.endTime <= clip.startTime
    ) {
      problems.add(`クリップ${index + 1}: 開始・終了時刻を確認してください`);
    }
    try {
      for (const source of getClipExportSources(clip, selection))
        requestedSources.add(source);
    } catch (error) {
      problems.add(
        `クリップ${index + 1}: ${error instanceof Error ? error.message : '映像を確認してください'}`,
      );
    }
  }
  const plans: ExportSourcePlan[] = [];
  const checkedFiles = new Map<string, boolean>();
  for (const source of requestedSources) {
    try {
      const plan = await planExportSource(source);
      plans.push(plan);
      for (const file of plan.clips?.map((clip) => clip.sourcePath) ?? [
        source,
      ]) {
        // Remote media keeps its existing export behavior; this preflight checks local files only.
        if (/^https?:\/\//i.test(file)) continue;
        let readable = checkedFiles.get(file);
        if (readable === undefined) {
          try {
            const stat = await fs.stat(file);
            await fs.access(file, constants.R_OK);
            readable = stat.isFile() && stat.size > 0;
          } catch {
            readable = false;
          }
          checkedFiles.set(file, readable);
        }
        if (!readable)
          problems.add(`映像を読み込めません: ${path.basename(file)}`);
      }
    } catch {
      problems.add(
        `パッケージの映像構成を確認してください: ${path.basename(source)}`,
      );
    }
  }
  try {
    if (!(await fs.stat(outputDir)).isDirectory())
      throw new Error('not a directory');
    await fs.access(outputDir, constants.W_OK);
  } catch {
    problems.add(
      '保存先フォルダに書き込めません。接続とアクセス権を確認してください',
    );
  }
  if (problems.size > 0) {
    const entries = [...problems];
    throw new Error(
      [
        '書き出し前の確認で問題が見つかりました。映像はまだ書き出していません。',
        ...entries.slice(0, 12),
        ...(entries.length > 12 ? [`ほか${entries.length - 12}件`] : []),
        '映像の移動・外付けドライブの接続を確認し、再試行してください。',
      ].join('\n'),
    );
  }
  return plans;
};
