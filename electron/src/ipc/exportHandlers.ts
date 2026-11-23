import { groupExportClips } from './groupExportClips';
import { prioritizeClipExport } from '../scrubPreview/exportPriority';
import { createExportResourceGate } from './exportResourceGate';
import { retainedFor } from './exportRetainedRecords';
import { ExportCopyIncomplete } from './exportBoundedCopy';
import { createExportResources, exportResourceContext } from './exportResourceContext';
import { NativeExportUnknownFailure } from '../nativeExport/nativeClipExport';
import type { NativeClipExporter } from '../nativeExport/nativeClipExport';
import { assertExportTextFits } from './exportTextInspection';
import { registerExportTextPreview } from './exportTextPreview';
import {
  portableExportStem,
  createExportNameAllocator,
} from './exportFileNames';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { renderExportClipGroup } from './exportClipGroup';
import { ensureMp4, normalizeAngleOption } from './exportOptions';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import type { ExportClipsPayload } from './exportHandlers.types';
import {
  updateExportProgressWindow,
  openExportProgressWindow,
  setExportCancelHandler,
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
import { publishExportOutput } from './exportOutputTransaction';
import { IndeterminatePublicationError } from './exportExclusivePublish';
import {
  drainExportProcesses,
  exportAbortContext,
  exportProcessContext,
} from './exportAbortContext';
import { createExportShutdownCoordinator } from './exportShutdownCoordinator';

interface RegisterExportHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  getFfmpegPath: () => string;
  nativeClipExporter?: NativeClipExporter;
}

let isRegistered = false;
const resourceGate = createExportResourceGate();

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
  retainedDirectories,
  retainedLocationUnknown,
}: {
  progressId: string;
  startedAt: number;
  current: number;
  total: number;
  message: string;
  status?: ExportProgressWindowState['status'];
  error?: string;
  retainedDirectories?: ExportProgressWindowState['retainedDirectories'];
  retainedLocationUnknown?: boolean;
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
    completedAt:
      status === 'running' || status === 'cancelling' ? undefined : now,
    error,
    retainedDirectories,
    retainedLocationUnknown,
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
  nativeClipExporter,
}: RegisterExportHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;
  const coordinator = createExportShutdownCoordinator(app);
  setExportCancelHandler(coordinator.cancel);
  registerExportTextPreview(getFfmpegPath);

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
      const job = coordinator.start(payload.progressId);
      const shutdown = { signal: job.signal };
      const activeProcesses = new Set<Promise<unknown>>();
      const startedAt = Date.now();
      let published = 0;
      const publishedOutputs: string[] = [];
      let cancelled = false;
      let stagingCleanupFailed = false;
      let commitCallbackFailed = false;
      let releaseResources: (() => void) | undefined;
      let retainedCopy: ExportProgressWindowState['retainedDirectories'];
      let retainedLocationUnknown = false;
      let pendingProgress: ExportProgressWindowState | undefined;
      let pendingSuccess: ExportProgressWindowState | undefined;
      let successOutcome: import('../../../src/shared/clipExport/clipExportTypes').ClipExportExecutionResult | undefined;
      let pendingFailure: { success: false; canceled?: boolean; error: string; retainedDirectories?: ExportProgressWindowState['retainedDirectories']; retainedLocationUnknown?: boolean; publishedOutputs?: string[] } | undefined;
      const commit = (final: boolean, outputPath: string) => ({
        begin: job.beginCommit,
        cleanupFailed: (record?: NonNullable<ExportProgressWindowState['retainedDirectories']>[number]) => {
          stagingCleanupFailed = true;
          if (record) retainedCopy = [...new Map([...(retainedCopy ?? []), record].map((entry) => [entry.id, entry])).values()];
          else retainedLocationUnknown = true;
        },
        cleanupNotificationFailed: () => {
          stagingCleanupFailed = true;
          retainedLocationUnknown = true;
        },
        callbackFailed: () => {
          commitCallbackFailed = true;
          if (!publishedOutputs.includes(outputPath)) { published++; publishedOutputs.push(outputPath); }
          job.finishCommit(final);
        },
        finish: (success: boolean) => {
          if (success) { published++; publishedOutputs.push(outputPath); }
          job.finishCommit(success && final);
        },
      });
      const finishedExport = prioritizeClipExport();
      return exportAbortContext.run(shutdown.signal, () =>
        exportProcessContext.run(activeProcesses, async () => {
          try {
            const {
              sourcePath,
              mode = 'single',
              exportMode = 'single',
              angleOption,
              outputDir,
              clips,
              outputFileName,
              progressId,
            } = payload;
            const progressStartedAt = Date.now();
            const getClipOutputDuration = (
              clip: ExportClipsPayload['clips'][number],
            ): number =>
              (clip.endTime - clip.startTime) +
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
              if (!progressId || shutdown.signal.aborted) {
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
              if (!progressId || shutdown.signal.aborted) {
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

            if ((!sourcePath && clips.some((clip) => !clip.slideFrame)) || clips.length === 0) {
              failProgress('ソースまたはクリップがありません');
              return {
                success: false,
                error: 'ソースまたはクリップがありません',
              };
            }

            await assertExportTextFits(payload);
            shutdown.signal.throwIfAborted();
            let targetDir = outputDir;
            if (!targetDir) {
              targetDir = await resolveOutputDir(event, getMainWindow);
              shutdown.signal.throwIfAborted();
              if (!targetDir) {
                failProgress('書き出しがキャンセルされました');
                return {
                  success: false,
                  error: '書き出しがキャンセルされました',
                };
              }
            }

            releaseResources = await resourceGate.acquire(shutdown.signal);
            const resources = await createExportResources(targetDir, shutdown.signal);
            await resources.check();
            return await exportResourceContext.run(resources, async () => {
            updateProgress('映像と保存先を確認中...');
            // The native folder picker can cover this window. Reveal once without stealing focus.
            if (progressId && !shutdown.signal.aborted)
              void openExportProgressWindow(false, true);
            const sourcePlans = await preflightClipExport(payload, targetDir);
            shutdown.signal.throwIfAborted();
            const jobs = buildExportPreparationJobs(payload, sourcePlans);
            progressTotal += jobs.reduce((total, job) => total + job.weight, 0);
            const preparedSources = await prepareExportSources(
              jobs,
              tempFiles,
              updateStageProgress,
              advanceProgress,
            );
            shutdown.signal.throwIfAborted();
            const { useDual } = resolveExportSourceSelection(payload);
            const normalizedAngleOption = normalizeAngleOption(
              angleOption,
              mode,
            );
            const renderClip = createPreparedClipRenderer(
              payload,
              preparedSources,
              tempFiles,
              getFfmpegPath,
              nativeClipExporter,
              shutdown.signal,
            );

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
                  ? ensureMp4(
                      `${baseName}_${instanceNum}_${safeAction}${suffix}`,
                    )
                  : ensureMp4(`${instanceNum}_${safeAction}${suffix}`);
                const outPath = path.join(targetDir, allocateName(outName));
                const clipDuration = getClipOutputDuration(clip);
                await publishExportOutput(
                  outPath,
                  async (stagingPath) => {
                    await renderClip(clip, stagingPath, (fraction) => {
                      updateStageProgress(
                        fraction,
                        clipDuration,
                        `${i + 1} / ${clips.length} クリップを書き出し中...`,
                      );
                    });
                  },
                  shutdown.signal,
                  commit(i === clips.length - 1, outPath),
                );
                advanceProgress(
                  clipDuration,
                  `${i + 1} / ${clips.length} クリップを書き出しました`,
                );
              }
            } else if (exportMode === 'perRow' || exportMode === 'organizerRows') {
              const groups = groupExportClips(clips, exportMode);
              let rowIndex = 0;
              for (const { label: actionName, clips: group } of groups) {
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

                let completedDuration = 0;
                await publishExportOutput(
                  outPath,
                  async (stagingPath) =>
                    renderExportClipGroup({
                      clips: group,
                      outputPath: stagingPath,
                      renderClip,
                      getFfmpegPath,
                      getDuration: getClipOutputDuration,
                      onRenderStart: () =>
                        updateProgress(`${actionName} のクリップを生成中...`),
                      onRenderProgress: (fraction, duration) =>
                        updateStageProgress(
                          fraction,
                          duration,
                          `${actionName} のクリップを生成中...`,
                        ),
                      onRendered: (duration) =>
                        advanceProgress(
                          duration,
                          `${actionName} のクリップを生成しました`,
                        ),
                      onJoinStart: () =>
                        updateProgress(`${actionName} を結合中...`),
                      onJoinProgress: (fraction, duration) =>
                        updateStageProgress(
                          fraction,
                          duration,
                          `${actionName} を結合中...`,
                        ),
                      onCompleted: (duration) => {
                        completedDuration = duration;
                      },
                    }),
                  shutdown.signal,
                  commit(rowIndex === groups.length - 1, outPath),
                );
                rowIndex++;
                advanceProgress(
                  completedDuration,
                  `${actionName} を書き出しました`,
                );
              }
            } else {
              let angleSuffix = '';
              if (useDual) angleSuffix = '_multi';
              else if (normalizedAngleOption === 'angle2')
                angleSuffix = '_angle2';
              else angleSuffix = '_angle1';

              const defaultName = `combined_${clips.length}${angleSuffix}.mp4`;
              const outName = outputFileName
                ? ensureMp4(`${baseName}${angleSuffix}`)
                : defaultName;
              const outPath = path.join(targetDir, allocateName(outName));

              let completedDuration = 0;
              await publishExportOutput(
                outPath,
                async (stagingPath) =>
                  renderExportClipGroup({
                    clips,
                    outputPath: stagingPath,
                    renderClip,
                    getFfmpegPath,
                    getDuration: getClipOutputDuration,
                    onRenderStart: (index) =>
                      updateProgress(
                        `${index + 1} / ${clips.length} クリップを生成中...`,
                      ),
                    onRenderProgress: (fraction, duration, index) =>
                      updateStageProgress(
                        fraction,
                        duration,
                        `${index + 1} / ${clips.length} クリップを生成中...`,
                      ),
                    onRendered: (duration, index) =>
                      advanceProgress(
                        duration,
                        `${index + 1} / ${clips.length} クリップを生成しました`,
                      ),
                    onJoinStart: () => updateProgress('クリップを結合中...'),
                    onJoinProgress: (fraction, duration) =>
                      updateStageProgress(
                        fraction,
                        duration,
                        'クリップを結合中...',
                      ),
                    onCompleted: (duration) => {
                      completedDuration = duration;
                    },
                  }),
                shutdown.signal,
                  commit(true, outPath),
              );
              advanceProgress(completedDuration, '一時データを確認中...');
            }

            if (progressId && !shutdown.signal.aborted) {
              pendingSuccess = buildProgressState({
                progressId, startedAt: progressStartedAt, current: progressTotal,
                total: Math.max(1, progressTotal), message: '書き出しが完了しました', status: 'completed',
              });
            }
            successOutcome = { success: true, publishedOutputs };
            return successOutcome;
            });
          } catch (err) {
            const uncertain = err instanceof IndeterminatePublicationError;
            const saved = retainedFor(err);
            const allRetained = [...(retainedCopy ?? []), ...(uncertain ? err.retainedDirectories : []), ...saved.directories];
            retainedCopy = [...new Map(allRetained.map((entry) => [entry.id, entry])).values()];
            if (!retainedCopy.length) retainedCopy = undefined;
            if (saved.locationUnknown) retainedLocationUnknown = true;
            if (err instanceof ExportCopyIncomplete && err.retainedPath) {
              stagingCleanupFailed = true;
              if (!saved.directories.length) retainedLocationUnknown = true;
            }
            if (err instanceof ExportCopyIncomplete && err.closeErrors.length) {
              stagingCleanupFailed = true;
              if (!retainedCopy) retainedLocationUnknown = true;
            }
            await drainExportProcesses(activeProcesses);
            if (err instanceof ExportCopyIncomplete)
              console.error('export-clips-with-overlay: incomplete copy retained');
            else if (err instanceof NativeExportUnknownFailure)
              console.error('export-clips-with-overlay: native helper failure');
            else if (uncertain)
              console.error(
                'export-clips-with-overlay: publication outcome uncertain',
              );
            else console.error('export-clips-with-overlay error', err);
            const copyCloseUnconfirmed = err instanceof ExportCopyIncomplete && err.closeErrors.length > 0;
            const copyMessage = err instanceof ExportCopyIncomplete
              ? copyCloseUnconfirmed ? 'コピーの終了を確認できません'
                : err.originalError && typeof err.originalError === 'object' && 'code' in err.originalError && err.originalError.code === 'ENOSPC'
                  ? '保存先の空き容量が不足しました'
                  : err.name === 'AbortError' ? 'コピーを中止しました' : 'コピーを完了できませんでした'
              : undefined;
            const partialNotice = publishedOutputs.length
              ? `\n保存済みの出力（${publishedOutputs.length}件）:\n${publishedOutputs.join('\n')}`
              : '';
            cancelled =
              !copyCloseUnconfirmed && job.cancelRequested() &&
              (err === shutdown.signal.reason ||
                (err instanceof Error && err.name === 'AbortError'));
            const maybePayload = isExportClipsPayload(payload) ? payload : null;
            const reportId =
              maybePayload?.progressId ??
              (uncertain || retainedCopy || retainedLocationUnknown || (err instanceof ExportCopyIncomplete && !!err.retainedPath) ? `export-uncertain-${randomUUID()}` : undefined);
            if (reportId && !coordinator.isQuitting() && !cancelled) {
              pendingProgress = buildProgressState({
                progressId: reportId,
                startedAt: Date.now(), current: 0, total: 1,
                message: uncertain ? '出力の確定結果を確認できません' : copyCloseUnconfirmed ? 'コピーの終了を確認できません' : '書き出しに失敗しました',
                status: 'failed',
                error: (uncertain ? '出力先と保全された一時フォルダをご確認ください。自動削除や再試行は行っていません。' : copyMessage ?? String(err)) + partialNotice,
                retainedDirectories: retainedCopy,
                retainedLocationUnknown,
              });
            }
            pendingFailure = cancelled
              ? {
                  success: false,
                  canceled: true,
                  error:
                    published > 0
                      ? `書き出しを中止しました（この処理の${published}件は保存済みです。以前に保存したファイルも残ります）`
                      : '書き出しを中止しました。以前に保存したファイルは残ります。',
                }
              : {
                  success: false,
                  error: uncertain
                    ? '出力の確定結果を確認できません。進捗ウィンドウをご確認ください。'
                    : (copyMessage ?? String(err)) + partialNotice,
                  retainedDirectories: retainedCopy,
                };
            if (retainedCopy) pendingFailure.retainedDirectories = retainedCopy;
            if ((uncertain || cancelled) && partialNotice) pendingFailure.error += partialNotice;
            if (retainedLocationUnknown) pendingFailure.retainedLocationUnknown = true;
            pendingFailure.publishedOutputs = publishedOutputs;
            return pendingFailure;
          } finally {
            await drainExportProcesses(activeProcesses);
            const cleanup = await Promise.allSettled(
              tempFiles.map((f) => fs.unlink(f)),
            );
            const tempCleanupFailed = cleanup.some(
                (result) =>
                  result.status === 'rejected' &&
                  !(
                    result.reason &&
                    typeof result.reason === 'object' &&
                    'code' in result.reason &&
                    result.reason.code === 'ENOENT'
                  ),
              );
            const cleanupFailed = stagingCleanupFailed || tempCleanupFailed;
            if (pendingFailure && commitCallbackFailed) {
              pendingFailure.error += '\n保存済み出力の完了状態の通知を確認できません';
              if (pendingProgress) pendingProgress.error = `${pendingProgress.error ?? ''}\n保存済み出力の完了状態の通知を確認できません`;
            }
            if (tempCleanupFailed) {
              retainedLocationUnknown = true;
              if (pendingFailure) pendingFailure.retainedLocationUnknown = true;
              if (pendingProgress) pendingProgress.retainedLocationUnknown = true;
              else if (pendingFailure && !cancelled) pendingProgress = buildProgressState({ progressId: payload.progressId ?? `export-uncertain-${randomUUID()}`, startedAt, current: 0, total: 1, message: '書き出しに失敗し、一時データの後処理を確認できません', status: 'failed', error: pendingFailure.error, retainedDirectories: retainedCopy, retainedLocationUnknown: true });
            }
            if (cancelled && (payload.progressId || retainedCopy || retainedLocationUnknown || cleanupFailed) && !coordinator.isQuitting()) {
              sendProgress(
                buildProgressState({
                  progressId: payload.progressId ?? `export-uncertain-${randomUUID()}`,
                  startedAt,
                  current: 0,
                  total: 1,
                  status: cleanupFailed ? 'failed' : 'cancelled',
                  message: (cleanupFailed
                    ? `中止しましたが、一時ファイルの片付けを完了できませんでした${publishedOutputs.length ? `（${publishedOutputs.length}件は保存済み）` : ''}`
                    : published > 0
                      ? `書き出しを中止しました（この処理の${published}件は保存済みです。以前に保存したファイルも残ります）`
                      : '書き出しを中止しました。以前に保存したファイルは残ります。') + (commitCallbackFailed ? ' 保存済み出力の完了状態の通知を確認できません。' : ''),
                  retainedDirectories: retainedCopy,
                  retainedLocationUnknown,
                }),
              );
            }
            if (successOutcome && (cleanupFailed || commitCallbackFailed)) {
              successOutcome.cleanupWarning = ['出力は保存されましたが、', commitCallbackFailed ? '完了状態の通知を確認できません' : '', cleanupFailed ? '一時データの後処理を確認できません' : ''].filter(Boolean).join(' ');
              successOutcome.retainedDirectories = retainedCopy;
              successOutcome.retainedLocationUnknown = retainedLocationUnknown;
              if (!pendingSuccess) pendingSuccess = buildProgressState({ progressId: `export-uncertain-${randomUUID()}`, startedAt, current: 1, total: 1, message: successOutcome.cleanupWarning, status: 'completed' });
              if (pendingSuccess) { pendingSuccess.message = successOutcome.cleanupWarning; pendingSuccess.retainedDirectories = retainedCopy; pendingSuccess.retainedLocationUnknown = successOutcome.retainedLocationUnknown; }
            }
            if (pendingSuccess && !coordinator.isQuitting()) sendProgress(pendingSuccess);
            if (pendingProgress && !coordinator.isQuitting()) {
              if (cleanupFailed) pendingProgress.message += '（一時データの後処理を確認できません）';
              sendProgress(pendingProgress);
            }
            releaseResources?.();
            job.release();
            if (cancelled && cleanupFailed && pendingFailure)
              pendingFailure.error = `中止しましたが、一時ファイルの片付けを完了できませんでした${publishedOutputs.length ? `\n保存済みの出力:\n${publishedOutputs.join('\n')}` : ''}`;
            if (cancelled && cleanupFailed && pendingFailure && commitCallbackFailed)
              pendingFailure.error += '\n保存済み出力の完了状態の通知を確認できません';
          }
        }),
      ).finally(finishedExport);
    },
  );
};
