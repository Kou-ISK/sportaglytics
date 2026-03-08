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
    async (event, payload: ExportClipsPayload) => {
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
        } = payload;

        if (!sourcePath || clips.length === 0) {
          return { success: false, error: 'ソースまたはクリップがありません' };
        }

        let targetDir = outputDir;
        if (!targetDir) {
          targetDir = await resolveOutputDir(event, getMainWindow);
          if (!targetDir) {
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
            return { success: false, error: dualError };
          }
        }

        const renderClip = async (clip: ExportClipsPayload['clips'][number], outputPath?: string): Promise<string> => {
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
              console.error('export-clips-with-overlay clip dual source error', {
                clipId: clip.id,
                sourcePath,
                sourcePath2,
                angleOption,
                mode,
                clipMainSource,
                clipSecondarySource,
              });
            }
            throw error;
          }
        };

        const baseName = outputFileName ? outputFileName.replace(/\.mp4$/i, '') : '';

        if (exportMode === 'perInstance') {
          for (let i = 0; i < clips.length; i += 1) {
            const clip = clips[i];
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
          }
        } else if (exportMode === 'perRow') {
          const byAction = new Map<string, ExportClipsPayload['clips'][number][]>();
          clips.forEach((clip) => {
            const arr = byAction.get(clip.actionName) || [];
            arr.push(clip);
            byAction.set(clip.actionName, arr);
          });

          for (const [actionName, group] of byAction.entries()) {
            const temps: string[] = [];
            for (const clip of group) {
              temps.push(await renderClip(clip));
            }

            const safeAction = actionName.replace(/\s+/g, '_');
            let angleSuffix = '';
            if (useDual) angleSuffix = '_multi';
            else if (normalizedAngleOption === 'angle2') angleSuffix = '_angle2';
            else angleSuffix = '_angle1';

            const fileName = `${safeAction}${angleSuffix}`;
            const outName = baseName
              ? ensureMp4(`${baseName}_${fileName}`)
              : ensureMp4(fileName);
            const outPath = path.join(targetDir, outName);

            await concatFiles(getFfmpegPath, temps, outPath);
            await Promise.all(temps.map((t) => fs.unlink(t).catch(() => undefined)));
          }
        } else {
          const temps: string[] = [];
          for (const clip of clips) {
            temps.push(await renderClip(clip));
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

          await concatFiles(getFfmpegPath, temps, outPath);
          await Promise.all(temps.map((t) => fs.unlink(t).catch(() => undefined)));
        }

        return { success: true };
      } catch (err) {
        console.error('export-clips-with-overlay error', err);
        return { success: false, error: String(err) };
      } finally {
        await Promise.all(tempFiles.map((f) => fs.unlink(f).catch(() => undefined)));
      }
    },
  );
};
