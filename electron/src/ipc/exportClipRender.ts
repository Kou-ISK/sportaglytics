import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  runFfmpegDual,
  runFfmpegSingle,
  type ExportClipForFfmpeg,
  type OverlayLine,
} from './exportFfmpegRunners';
import {
  escapeDrawtext,
  getJapaneseFontPath,
  resolveDualSourceError,
} from './exportOptions';
import type {
  ClipExportItem,
  ExportOverlayOptions,
} from './exportHandlers.types';

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

export const formatOverlayLines = (
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
      .map((label) => (label.group ? `${label.group}: ${label.name}` : label.name))
      .join(', ');
    lines.push({ text: labelText, isBold: false });
  }

  if (overlay.showMemo && clip.memo) {
    lines.push({ text: clip.memo, isBold: false });
  }

  return lines;
};

interface RenderClipWithFfmpegParams {
  getFfmpegPath: () => string;
  clip: ClipExportItem;
  overlay: ExportOverlayOptions;
  mainSource: string;
  secondarySource?: string | null;
  useDual: boolean;
  tempFiles: string[];
  outputPath?: string;
}

export const renderClipWithFfmpeg = async ({
  getFfmpegPath,
  clip,
  overlay,
  mainSource,
  secondarySource,
  useDual,
  tempFiles,
  outputPath,
}: RenderClipWithFfmpegParams): Promise<string> => {
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
    return target;
  }

  if (clip.angleType === 'angle1') {
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
    return target;
  }

  if (useDual) {
    const dualError = resolveDualSourceError(clipMainSource, clipSecondarySource);
    if (dualError) {
      throw new Error(dualError);
    }
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
    return target;
  }

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

  return target;
};
