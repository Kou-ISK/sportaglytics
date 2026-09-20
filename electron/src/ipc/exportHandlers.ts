import {
  portableExportStem,
  createExportNameAllocator,
} from './exportFileNames';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { concatFiles } from './exportFfmpegRunners';
import { ensureMp4, normalizeAngleOption } from './exportOptions';
import { renderClipWithFfmpeg } from './exportClipRender';
import type { ExportClipsPayload } from './exportHandlers.types';
import {
  updateExportProgressWindow,
  openExportProgressWindow,
} from '../exportProgressWindow';
import type { ExportProgressWindowState } from '../../../src/types/ipc/exportProgressWindow';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import {
  buildExportPreparationJobs,
  prepareExportSources,
} from './exportSourcePreparation';
import { preflightClipExport } from './exportPreflight';
import { resolveExportSourceSelection } from './exportSourceSelection';
import { isExportClipsPayload } from './exportPayloadValidation';

interface RegisterExportHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  getFfmpegPath: () => string;
}

let isRegistered = false;

const resolveOutputDir = async (
  event: Electron.IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null,
): Promise<string | undefined> => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = getMainWindow();
  const parentWindow = senderWindow ?? mainWindow;
  const res = parentWindow
    ? await dialog.showOpenDialog(parentWindow, {
        properties: ['openDirectory', 'createDirectory'],
      })
    : await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

  if (res.canceled || res.filePaths.length === 0) {
    return undefined;
  }

  return res.filePaths[0];
};

const buildProgressState = ({
  progressId,
  startedAt,
  current,
  total,
  message,
  status = 'running',
  error,
}: {
  progressId: string;
  startedAt: number;
  current: number;
  total: number;
  message: string;
  status?: ExportProgressWindowState['status'];
  error?: string;
}): ExportProgressWindowState => {
  const now = Date.now();
  return {
    id: progressId,
    status,
    current,
    total,
    message,
    startedAt,
    updatedAt: now,
    completedAt: status === 'running' ? undefined : now,
    error,
  };
};

const sendProgress = (state: ExportProgressWindowState | null): void => {
  if (!state) {
    return;
  }
  updateExportProgressWindow(state);
};

export const registerExportHandlers = ({
  getMainWindow,
  getFfmpegPath,
}: RegisterExportHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'export-clips-with-overlay',
    async (event, payload: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid clip export sender');
      }
      if (!isExportClipsPayload(payload)) {
        return { success: false, error: 'Invalid clip export payload' };
      }

      const tempFiles: string[] = [];
      try {
        const {
          sourcePath,
          sourcePath2,
          mode = 'single',
          exportMode = 'single',
          angleOption,
          outputDir,
          clips,
          overlay,
          outputFileName,
          progressId,
        } = payload;
        const progressStartedAt = Date.now();
        const getClipOutputDuration = (
          clip: ExportClipsPayload['clips'][number],
        ): number =>
          Math.max(0.5, clip.endTime - clip.startTime) +
          Math.max(0, clip.freezeDuration ?? 0);
        const renderDurationTotal = clips.reduce(
          (total, clip) => total + getClipOutputDuration(clip),
          0,
        );
        let completedProgressWeight = 0;
        let reportedProgressCurrent = 0;
        let progressTotal =
          exportMode === 'perInstance'
            ? renderDurationTotal
            : renderDurationTotal * 2;
        const updateProgress = (message: string): void => {
          if (!progressId) {
            return;
          }
          sendProgress(
            buildProgressState({
              progressId,
              startedAt: progressStartedAt,
              current: reportedProgressCurrent,
              total: Math.max(1, progressTotal),
              message,
            }),
          );
        };
        const failProgress = (message: string): void => {
          if (!progressId) {
            return;
          }
          sendProgress(
            buildProgressState({
              progressId,
              startedAt: progressStartedAt,
              current: reportedProgressCurrent,
              total: Math.max(1, progressTotal),
              message,
              status: 'failed',
              error: message,
            }),
          );
        };
        const advanceProgress = (weight: number, message: string): void => {
          completedProgressWeight = Math.min(
            completedProgressWeight + weight,
            progressTotal,
          );
          reportedProgressCurrent = completedProgressWeight;
          updateProgress(message);
        };
        const updateStageProgress = (
          fraction: number,
          weight: number,
          message: string,
        ): void => {
          const normalizedFraction = Math.min(1, Math.max(0, fraction));
          reportedProgressCurrent = Math.max(
            reportedProgressCurrent,
            Math.min(
              progressTotal,
              completedProgressWeight + normalizedFraction * weight,
            ),
          );
          updateProgress(message);
        };

        updateProgress('書き出し準備中...');

        if (!sourcePath || clips.length === 0) {
          failProgress('ソースまたはクリップがありません');
          return { success: false, error: 'ソースまたはクリップがありません' };
        }

        let targetDir = outputDir;
        if (!targetDir) {
          targetDir = await resolveOutputDir(event, getMainWindow);
          if (!targetDir) {
            failProgress('書き出しがキャンセルされました');
            return { success: false, error: '書き出しがキャンセルされました' };
          }
        }

        updateProgress('映像と保存先を確認中...');
        // The native folder picker can cover this window. Reveal once without stealing focus.
        if (progressId) void openExportProgressWindow(false, true);
        const sourcePlans = await preflightClipExport(payload, targetDir);
        const jobs = buildExportPreparationJobs(payload, sourcePlans);
        progressTotal += jobs.reduce((total, job) => total + job.weight, 0);
        const { sources: resolvedSourceMap, timeOrigins } =
          await prepareExportSources(
            jobs,
            tempFiles,
            updateStageProgress,
            advanceProgress,
          );
        const resolveSource = (
          source: string | null | undefined,
        ): string | undefined =>
          source ? (resolvedSourceMap.get(source) ?? source) : undefined;
        const selection = resolveExportSourceSelection(payload);
        const mainSource =
          resolveSource(selection.mainSource) || selection.mainSource;
        const secondarySource = resolveSource(selection.secondarySource);
        const useDual = selection.useDual;
        const normalizedAngleOption = normalizeAngleOption(angleOption, mode);

        const renderClip = async (
          clip: ExportClipsPayload['clips'][number],
          outputPath?: string,
          onProgress?: (progress: number) => void,
        ): Promise<string> => {
          try {
            return await renderClipWithFfmpeg({
              getFfmpegPath,
              clip: {
                ...clip,
                videoSource: resolveSource(clip.videoSource),
                videoSource2: resolveSource(clip.videoSource2),
              },
              overlay,
              mainSource,
              secondarySource,
              useDual,
              tempFiles,
              sourceTimeOrigins: timeOrigins,
              outputPath,
              onProgress,
            });
          } catch (error) {
            if (useDual) {
              const clipMainSource = clip.videoSource || mainSource;
              const clipSecondarySource = clip.videoSource2 || secondarySource;
              console.error(
                'export-clips-with-overlay clip dual source error',
                {
                  clipId: clip.id,
                  sourcePath,
                  sourcePath2,
                  angleOption,
                  mode,
                  clipMainSource,
                  clipSecondarySource,
                },
              );
            }
            throw error;
          }
        };

        const allocateName = createExportNameAllocator(
          await fs.readdir(targetDir),
        );
        const baseName = outputFileName
          ? portableExportStem(outputFileName.replace(/\.mp4$/i, ''))
          : '';
        if (exportMode === 'perInstance') {
          for (let i = 0; i < clips.length; i += 1) {
            const clip = clips[i];
            updateProgress(
              `${i + 1} / ${clips.length} クリップを書き出し中...`,
            );
            const safeAction = portableExportStem(clip.actionName);
            const instanceNum = String(i + 1).padStart(3, '0');
            let suffix = '';
            if (useDual) suffix = '_multi';
            else if (normalizedAngleOption === 'angle2') suffix = '_angle2';
            else suffix = '_angle1';

            const outName = baseName
              ? ensureMp4(`${baseName}_${instanceNum}_${safeAction}${suffix}`)
              : ensureMp4(`${instanceNum}_${safeAction}${suffix}`);
            const outPath = path.join(targetDir, allocateName(outName));
            const clipDuration = getClipOutputDuration(clip);
            await renderClip(clip, outPath, (fraction) => {
              updateStageProgress(
                fraction,
                clipDuration,
                `${i + 1} / ${clips.length} クリップを書き出し中...`,
              );
            });
            advanceProgress(
              clipDuration,
              `${i + 1} / ${clips.length} クリップを書き出しました`,
            );
          }
        } else if (exportMode === 'perRow') {
          const byAction = new Map<
            string,
            ExportClipsPayload['clips'][number][]
          >();
          clips.forEach((clip) => {
            const arr = byAction.get(clip.actionName) || [];
            arr.push(clip);
            byAction.set(clip.actionName, arr);
          });

          for (const [actionName, group] of byAction.entries()) {
            const temps: string[] = [];
            for (const clip of group) {
              const clipDuration = getClipOutputDuration(clip);
              updateProgress(`${actionName} のクリップを生成中...`);
              temps.push(
                await renderClip(clip, undefined, (fraction) => {
                  updateStageProgress(
                    fraction,
                    clipDuration,
                    `${actionName} のクリップを生成中...`,
                  );
                }),
              );
              advanceProgress(
                clipDuration,
                `${actionName} のクリップを生成しました`,
              );
            }

            const safeAction = portableExportStem(actionName);
            let angleSuffix = '';
            if (useDual) angleSuffix = '_multi';
            else if (normalizedAngleOption === 'angle2')
              angleSuffix = '_angle2';
            else angleSuffix = '_angle1';

            const fileName = `${safeAction}${angleSuffix}`;
            const outName = baseName
              ? ensureMp4(`${baseName}_${fileName}`)
              : ensureMp4(fileName);
            const outPath = path.join(targetDir, allocateName(outName));

            updateProgress(`${actionName} を結合中...`);
            const groupDuration = group.reduce(
              (total, clip) => total + getClipOutputDuration(clip),
              0,
            );
            await concatFiles(getFfmpegPath, temps, outPath, {
              durationSeconds: groupDuration,
              onProgress: (fraction) => {
                updateStageProgress(
                  fraction,
                  groupDuration,
                  `${actionName} を結合中...`,
                );
              },
            });
            advanceProgress(groupDuration, `${actionName} を書き出しました`);
            await Promise.all(
              temps.map((t) => fs.unlink(t).catch(() => undefined)),
            );
          }
        } else {
          const temps: string[] = [];
          for (let i = 0; i < clips.length; i += 1) {
            const clip = clips[i];
            const clipDuration = getClipOutputDuration(clip);
            updateProgress(`${i + 1} / ${clips.length} クリップを生成中...`);
            temps.push(
              await renderClip(clip, undefined, (fraction) => {
                updateStageProgress(
                  fraction,
                  clipDuration,
                  `${i + 1} / ${clips.length} クリップを生成中...`,
                );
              }),
            );
            advanceProgress(
              clipDuration,
              `${i + 1} / ${clips.length} クリップを生成しました`,
            );
          }

          let angleSuffix = '';
          if (useDual) angleSuffix = '_multi';
          else if (normalizedAngleOption === 'angle2') angleSuffix = '_angle2';
          else angleSuffix = '_angle1';

          const defaultName = `combined_${clips.length}${angleSuffix}.mp4`;
          const outName = outputFileName
            ? ensureMp4(`${baseName}${angleSuffix}`)
            : defaultName;
          const outPath = path.join(targetDir, allocateName(outName));

          updateProgress('クリップを結合中...');
          await concatFiles(getFfmpegPath, temps, outPath, {
            durationSeconds: clips.reduce(
              (total, clip) => total + getClipOutputDuration(clip),
              0,
            ),
            onProgress: (fraction) => {
              updateStageProgress(
                fraction,
                renderDurationTotal,
                'クリップを結合中...',
              );
            },
          });
          advanceProgress(renderDurationTotal, '書き出しが完了しました');
          await Promise.all(
            temps.map((t) => fs.unlink(t).catch(() => undefined)),
          );
        }

        if (progressId) {
          sendProgress(
            buildProgressState({
              progressId,
              startedAt: progressStartedAt,
              current: progressTotal,
              total: Math.max(1, progressTotal),
              message: '書き出しが完了しました',
              status: 'completed',
            }),
          );
        }
        return { success: true };
      } catch (err) {
        console.error('export-clips-with-overlay error', err);
        const maybePayload = isExportClipsPayload(payload) ? payload : null;
        if (maybePayload?.progressId) {
          sendProgress(
            buildProgressState({
              progressId: maybePayload.progressId,
              startedAt: Date.now(),
              current: 0,
              total: 1,
              message: '書き出しに失敗しました',
              status: 'failed',
              error: String(err),
            }),
          );
        }
        return { success: false, error: String(err) };
      } finally {
        await Promise.all(
          tempFiles.map((f) => fs.unlink(f).catch(() => undefined)),
        );
      }
    },
  );
};
