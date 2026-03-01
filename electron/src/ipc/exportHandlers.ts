import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  concatFiles,
  runFfmpegDual,
  runFfmpegSingle,
  type ExportClipForFfmpeg,
  type OverlayLine,
} from './exportFfmpegRunners';

interface RegisterExportHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  getFfmpegPath: () => string;
}

interface ClipLabel {
  group: string;
  name: string;
}

interface ClipExportItem {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  freezeAt?: number | null;
  freezeDuration?: number;
  labels?: ClipLabel[];
  memo?: string;
  actionIndex?: number;
  annotationPngPrimary?: string | null;
  annotationPngSecondary?: string | null;
  videoSource?: string;
  videoSource2?: string;
  angleType?: 'angle1' | 'angle2';
}

interface ExportOverlayOptions {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
  textTemplate: string;
}

interface ExportClipsPayload {
  sourcePath: string;
  sourcePath2?: string;
  mode?: 'single' | 'dual';
  exportMode?: 'single' | 'perInstance' | 'perRow';
  angleOption?:
    | 'all'
    | 'angle1'
    | 'angle2'
    | 'allAngles'
    | 'single'
    | 'multi';
  outputDir?: string;
  outputFileName?: string;
  clips: ClipExportItem[];
  overlay: ExportOverlayOptions;
}

let isRegistered = false;

type NormalizedAngleOption =
  | 'allAngles'
  | 'single'
  | 'multi'
  | 'angle1'
  | 'angle2';

const normalizeAngleOption = (
  angleOption: ExportClipsPayload['angleOption'],
  mode: ExportClipsPayload['mode'],
): NormalizedAngleOption => {
  if (angleOption === 'all' || angleOption === 'allAngles') {
    return 'allAngles';
  }
  if (angleOption === 'multi') {
    return 'multi';
  }
  if (angleOption === 'angle2') {
    return 'angle2';
  }
  if (angleOption === 'angle1') {
    return 'angle1';
  }
  if (mode === 'dual') {
    return 'multi';
  }
  return 'single';
};

const ensureMp4 = (name: string): string =>
  name.toLowerCase().endsWith('.mp4') ? name : `${name}.mp4`;

const getJapaneseFontPath = (isBold = false): string => {
  const platform = os.platform();
  if (platform === 'darwin') {
    return isBold
      ? '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'
      : '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc';
  }
  if (platform === 'win32') {
    return isBold
      ? 'C:\\Windows\\Fonts\\meiryob.ttc'
      : 'C:\\Windows\\Fonts\\meiryo.ttc';
  }
  return isBold
    ? '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
    : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
};

const wrapText = (text: string, maxChars = 60): string => {
  if (text.length <= maxChars) return text;
  const lines: string[] = [];
  let currentLine = '';
  const words = text.split(' ');

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
};

const escapeDrawtext = (text: string): string => {
  const wrapped = wrapText(text, 60);
  return wrapped
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\''")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
};

const dataUrlToTempFile = async (
  dataUrl: string,
  prefix: string,
  tempFiles: string[],
): Promise<string> => {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL for annotation overlay');
  }
  const buffer = Buffer.from(match[2], 'base64');
  const tempPath = path.join(
    os.tmpdir(),
    `${prefix}_${Date.now()}_${Math.random()}.png`,
  );
  await fs.writeFile(tempPath, buffer);
  tempFiles.push(tempPath);
  return tempPath;
};

const formatOverlayLines = (
  clip: ClipExportItem,
  overlay: ExportOverlayOptions,
): OverlayLine[] => {
  const lines: OverlayLine[] = [];

  if (overlay.showActionName) {
    const index = clip.actionIndex ?? 1;
    lines.push({ text: `#${index} ${clip.actionName}`, isBold: true });
  }

  if (overlay.showLabels && clip.labels && clip.labels.length > 0) {
    const labelText = clip.labels
      .map((l) => (l.group ? `${l.group}: ${l.name}` : l.name))
      .join(', ');
    lines.push({ text: labelText, isBold: false });
  }

  if (overlay.showMemo && clip.memo) {
    lines.push({ text: clip.memo, isBold: false });
  }

  return lines;
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

        const renderClip = async (
          clip: ClipExportItem,
          outputPath?: string,
        ): Promise<string> => {
          const overlayLines = formatOverlayLines(clip, overlay);
          const target =
            outputPath ||
            path.join(
              os.tmpdir(),
              `clip_${clip.id}_${Date.now()}_${Math.random()}.mp4`,
            );

          let annPrimaryPath: string | null = null;
          let annSecondaryPath: string | null = null;

          if (clip.annotationPngPrimary) {
            annPrimaryPath = await dataUrlToTempFile(
              clip.annotationPngPrimary,
              `anno_p_${clip.id}`,
              tempFiles,
            );
          }
          if (clip.annotationPngSecondary) {
            annSecondaryPath = await dataUrlToTempFile(
              clip.annotationPngSecondary,
              `anno_s_${clip.id}`,
              tempFiles,
            );
          }

          const clipMainSource = clip.videoSource || mainSource;
          const clipSecondarySource = clip.videoSource2 || secondarySource;
          const ffmpegClip: ExportClipForFfmpeg = {
            startTime: clip.startTime,
            endTime: clip.endTime,
            freezeAt: clip.freezeAt,
            freezeDuration: clip.freezeDuration,
          };

          if (clip.angleType === 'angle2') {
            const secondaryOnly = clipSecondarySource || clipMainSource;
            await runFfmpegSingle({
              getFfmpegPath,
              sourcePath: secondaryOnly,
              clip: ffmpegClip,
              outputPath: target,
              overlayEnabled: overlay.enabled,
              overlayLines,
              annotationPath: annSecondaryPath,
              getJapaneseFontPath,
              escapeDrawtext,
            });
          } else if (clip.angleType === 'angle1') {
            await runFfmpegSingle({
              getFfmpegPath,
              sourcePath: clipMainSource,
              clip: ffmpegClip,
              outputPath: target,
              overlayEnabled: overlay.enabled,
              overlayLines,
              annotationPath: annPrimaryPath,
              getJapaneseFontPath,
              escapeDrawtext,
            });
          } else if (useDual) {
            await runFfmpegDual({
              getFfmpegPath,
              mainSource: clipMainSource,
              secondarySource: clipSecondarySource,
              clip: ffmpegClip,
              outputPath: target,
              overlayEnabled: overlay.enabled,
              overlayLines,
              annotationPrimary: annPrimaryPath,
              annotationSecondary: annSecondaryPath,
              getJapaneseFontPath,
              escapeDrawtext,
            });
          } else {
            await runFfmpegSingle({
              getFfmpegPath,
              sourcePath: clipMainSource,
              clip: ffmpegClip,
              outputPath: target,
              overlayEnabled: overlay.enabled,
              overlayLines,
              annotationPath: annPrimaryPath,
              getJapaneseFontPath,
              escapeDrawtext,
            });
          }

          return target;
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
          const byAction = new Map<string, ClipExportItem[]>();
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
