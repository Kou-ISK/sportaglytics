import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { concatFiles } from './exportFfmpegRunners';
import {
  ensureMp4,
  normalizeAngleOption,
  resolveDualSourceError,
} from './exportOptions';
import { renderClipWithFfmpeg } from './exportClipRender';
import type { ExportClipsPayload } from './exportHandlers.types';
import { updateExportProgressWindow } from '../exportProgressWindow';
import type { ExportProgressWindowState } from '../../../src/types/ipc/exportProgressWindow';
import { isNonEmptyString, isPlainObject } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterExportHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  getFfmpegPath: () => string;
}

let isRegistered = false;

const isOptionalString = (value: unknown): boolean => {
  return value === undefined || typeof value === 'string';
};

const isOptionalNumber = (value: unknown): boolean => {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
};

const isClipExportOverlay = (value: unknown): boolean => {
  return (
    isPlainObject(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.showActionName === 'boolean' &&
    typeof value.showActionIndex === 'boolean' &&
    typeof value.showLabels === 'boolean' &&
    typeof value.showMemo === 'boolean'
  );
};

const isExportMode = (value: unknown): boolean => {
  return (
    value === undefined ||
    value === 'single' ||
    value === 'perInstance' ||
    value === 'perRow'
  );
};

const isAngleOption = (value: unknown): boolean => {
  return (
    value === undefined ||
    value === 'all' ||
    value === 'allAngles' ||
    value === 'single' ||
    value === 'multi' ||
    value === 'angle1' ||
    value === 'angle2'
  );
};

const isClipExportItem = (value: unknown): boolean => {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.id) &&
    typeof value.actionName === 'string' &&
    typeof value.startTime === 'number' &&
    Number.isFinite(value.startTime) &&
    typeof value.endTime === 'number' &&
    Number.isFinite(value.endTime) &&
    isOptionalNumber(value.freezeAt) &&
    isOptionalNumber(value.freezeDuration) &&
    isOptionalString(value.memo) &&
    isOptionalString(value.videoSource) &&
    isOptionalString(value.videoSource2) &&
    (value.angleType === undefined ||
      value.angleType === 'angle1' ||
      value.angleType === 'angle2')
  );
};

const isExportClipsPayload = (value: unknown): value is ExportClipsPayload => {
  return (
    isPlainObject(value) &&
    isOptionalString(value.progressId) &&
    isNonEmptyString(value.sourcePath) &&
    isOptionalString(value.sourcePath2) &&
    (value.mode === undefined ||
      value.mode === 'single' ||
      value.mode === 'dual') &&
    isExportMode(value.exportMode) &&
    isAngleOption(value.angleOption) &&
    Array.isArray(value.clips) &&
    value.clips.every(isClipExportItem) &&
    isClipExportOverlay(value.overlay) &&
    isOptionalString(value.outputDir) &&
    isOptionalString(value.outputFileName)
  );
};

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

const sendProgress = (
  state: ExportProgressWindowState | null,
): void => {
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
        let progressCurrent = 0;
        const progressTotal =
          exportMode === 'perInstance'
            ? clips.length
            : exportMode === 'perRow'
              ? clips.length + new Set(clips.map((clip) => clip.actionName)).size
              : clips.length + 1;
        const updateProgress = (message: string): void => {
          if (!progressId) {
            return;
          }
          sendProgress(
            buildProgressState({
              progressId,
              startedAt: progressStartedAt,
              current: progressCurrent,
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
              current: progressCurrent,
              total: Math.max(1, progressTotal),
              message,
              status: 'failed',
              error: message,
            }),
          );
        };
        const advanceProgress = (message: string): void => {
          progressCurrent = Math.min(progressCurrent + 1, progressTotal);
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

        const normalizedAngleOption = normalizeAngleOption(angleOption, mode);
        const mainSource =
          normalizedAngleOption === 'angle2'
            ? sourcePath2 || sourcePath
            : sourcePath;
        const secondarySource =
          normalizedAngleOption === 'allAngles' ||
          normalizedAngleOption === 'multi' ||
          mode === 'dual'
            ? sourcePath2 || null
            : null;
        const useDual = mode === 'dual' || Boolean(secondarySource);

        if (useDual) {
          const dualError = resolveDualSourceError(mainSource, secondarySource);
          if (dualError) {
            console.error('export-clips-with-overlay dual preflight failed', {
              sourcePath,
              sourcePath2,
              angleOption,
              mode,
              mainSource,
              secondarySource,
            });
            failProgress(dualError);
            return { success: false, error: dualError };
          }
        }

        const renderClip = async (
          clip: ExportClipsPayload['clips'][number],
          outputPath?: string,
        ): Promise<string> => {
          try {
            return await renderClipWithFfmpeg({
              getFfmpegPath,
              clip,
              overlay,
              mainSource,
              secondarySource,
              useDual,
              tempFiles,
              outputPath,
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

        const baseName = outputFileName
          ? outputFileName.replace(/\.mp4$/i, '')
          : '';

        if (exportMode === 'perInstance') {
          for (let i = 0; i < clips.length; i += 1) {
            const clip = clips[i];
            updateProgress(
              `${i + 1} / ${clips.length} クリップを書き出し中...`,
            );
            const safeAction = clip.actionName.replace(/[\s/\\:*?"<>|]/g, '_');
            const instanceNum = String(i + 1).padStart(3, '0');
            let suffix = '';
            if (useDual) suffix = '_multi';
            else if (normalizedAngleOption === 'angle2') suffix = '_angle2';
            else suffix = '_angle1';

            const outName = baseName
              ? ensureMp4(`${baseName}_${instanceNum}_${safeAction}${suffix}`)
              : ensureMp4(`${instanceNum}_${safeAction}${suffix}`);
            const outPath = path.join(targetDir, outName);
            await renderClip(clip, outPath);
            advanceProgress(
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
              updateProgress(`${actionName} のクリップを生成中...`);
              temps.push(await renderClip(clip));
              advanceProgress(`${actionName} のクリップを生成しました`);
            }

            const safeAction = actionName.replace(/\s+/g, '_');
            let angleSuffix = '';
            if (useDual) angleSuffix = '_multi';
            else if (normalizedAngleOption === 'angle2')
              angleSuffix = '_angle2';
            else angleSuffix = '_angle1';

            const fileName = `${safeAction}${angleSuffix}`;
            const outName = baseName
              ? ensureMp4(`${baseName}_${fileName}`)
              : ensureMp4(fileName);
            const outPath = path.join(targetDir, outName);

            updateProgress(`${actionName} を結合中...`);
            await concatFiles(getFfmpegPath, temps, outPath);
            advanceProgress(`${actionName} を書き出しました`);
            await Promise.all(
              temps.map((t) => fs.unlink(t).catch(() => undefined)),
            );
          }
        } else {
          const temps: string[] = [];
          for (let i = 0; i < clips.length; i += 1) {
            const clip = clips[i];
            updateProgress(
              `${i + 1} / ${clips.length} クリップを生成中...`,
            );
            temps.push(await renderClip(clip));
            advanceProgress(
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
          const outPath = path.join(targetDir, outName);

          updateProgress('クリップを結合中...');
          await concatFiles(getFfmpegPath, temps, outPath);
          advanceProgress('書き出しが完了しました');
          await Promise.all(
            temps.map((t) => fs.unlink(t).catch(() => undefined)),
          );
        }

        if (progressId) {
          sendProgress(
            buildProgressState({
              progressId,
              startedAt: progressStartedAt,
              current: Math.max(progressCurrent, progressTotal),
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
