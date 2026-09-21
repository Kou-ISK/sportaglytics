import { hasExportAudio } from './exportAudioProbe';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  runFfmpegDual,
  runFfmpegSingle,
  type ExportClipForFfmpeg,
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

import { formatOverlayLines } from '../../../src/shared/clipExport/clipExportTextLayout';
export { formatOverlayLines } from '../../../src/shared/clipExport/clipExportTextLayout';

interface RenderClipWithFfmpegParams {
  getFfmpegPath: () => string;
  clip: ClipExportItem;
  overlay: ExportOverlayOptions;
  mainSource: string;
  secondarySource?: string | null;
  useDual: boolean;
  tempFiles: string[];
  sourceTimeOrigins?: ReadonlyMap<string, number>;
  outputPath?: string;
  onProgress?: (progress: number) => void;
}

export const renderClipWithFfmpeg = async ({
  getFfmpegPath,
  clip,
  overlay,
  mainSource,
  secondarySource,
  useDual,
  tempFiles,
  sourceTimeOrigins,
  outputPath,
  onProgress,
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

  if (!clip.freezeFrames && clip.annotationPngPrimary) {
    annPrimaryPath = await dataUrlToTempFile(
      clip.annotationPngPrimary,
      `anno_p_${clip.id}`,
      tempFiles,
    );
  }
  if (!clip.freezeFrames && clip.annotationPngSecondary) {
    annSecondaryPath = await dataUrlToTempFile(
      clip.annotationPngSecondary,
      `anno_s_${clip.id}`,
      tempFiles,
    );
  }

  const freezeFrames = clip.freezeFrames
    ? await Promise.all(
        clip.freezeFrames.map(async (frame, index) => ({
          time: frame.time,
          duration: frame.duration,
          primary: frame.annotationPngPrimary
            ? await dataUrlToTempFile(
                frame.annotationPngPrimary,
                `anno_p_${clip.id}_${index}`,
                tempFiles,
              )
            : null,
          secondary: frame.annotationPngSecondary
            ? await dataUrlToTempFile(
                frame.annotationPngSecondary,
                `anno_s_${clip.id}_${index}`,
                tempFiles,
              )
            : null,
        })),
      )
    : undefined;

  const clipMainSource = clip.videoSource || mainSource;
  const clipSecondarySource = clip.videoSource2 || secondarySource;
  const motionOverlays = clip.motionOverlays
    ? await Promise.all(
        clip.motionOverlays.map(async ({ png, ...entry }, index) => ({
          ...entry,
          image: await dataUrlToTempFile(
            png,
            `motion_${clip.id}_${index}`,
            tempFiles,
          ),
        })),
      )
    : undefined;
  const selectedSource =
    clip.angleType === 'angle2'
      ? clipSecondarySource || clipMainSource
      : clipMainSource;
  const primaryOrigin = sourceTimeOrigins?.get(selectedSource) ?? 0;
  const secondaryOrigin =
    sourceTimeOrigins?.get(clipSecondarySource ?? '') ?? 0;
  const ffmpegClip: ExportClipForFfmpeg = {
    chromaKey: clip.chromaKey,
    hasAudio: await hasExportAudio(
      clip.angleType === 'angle2'
        ? clipSecondarySource || clipMainSource
        : clipMainSource,
    ),
    motionOverlays,
    freezeFrames,
    startTime: clip.startTime - primaryOrigin,
    endTime: clip.endTime - primaryOrigin,
    secondaryStartTime: clip.startTime - secondaryOrigin,
    freezeAt: clip.freezeAt,
    freezeDuration: clip.freezeDuration,
  };

  if (clip.angleType === 'angle2') {
    const secondaryOnly = clipSecondarySource || clipMainSource;
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: secondaryOnly,
      clip: {
        ...ffmpegClip,
        chromaKey: { primary: clip.chromaKey?.secondary },
        motionOverlays: motionOverlays
          ?.filter((entry) => entry.target === 'secondary')
          .map((entry) => ({ ...entry, target: 'primary' })),
        freezeFrames: freezeFrames?.map((frame) => ({
          ...frame,
          primary: frame.secondary,
        })),
      },
      outputPath: target,
      overlayEnabled: overlay.enabled && overlayLines.length > 0,
      overlayLines,
      annotationPath: annSecondaryPath,
      getJapaneseFontPath,
      escapeDrawtext,
      onProgress,
    });
    return target;
  }

  if (clip.angleType === 'angle1') {
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: clipMainSource,
      clip: ffmpegClip,
      outputPath: target,
      overlayEnabled: overlay.enabled && overlayLines.length > 0,
      overlayLines,
      annotationPath: annPrimaryPath,
      getJapaneseFontPath,
      escapeDrawtext,
      onProgress,
    });
    return target;
  }

  if (useDual) {
    const dualError = resolveDualSourceError(
      clipMainSource,
      clipSecondarySource,
    );
    if (dualError) {
      throw new Error(dualError);
    }
    await runFfmpegDual({
      getFfmpegPath,
      mainSource: clipMainSource,
      secondarySource: clipSecondarySource,
      clip: ffmpegClip,
      outputPath: target,
      overlayEnabled: overlay.enabled && overlayLines.length > 0,
      overlayLines,
      annotationPrimary: annPrimaryPath,
      annotationSecondary: annSecondaryPath,
      getJapaneseFontPath,
      escapeDrawtext,
      onProgress,
    });
    return target;
  }

  await runFfmpegSingle({
    getFfmpegPath,
    sourcePath: clipMainSource,
    clip: ffmpegClip,
    outputPath: target,
    overlayEnabled: overlay.enabled && overlayLines.length > 0,
    overlayLines,
    annotationPath: annPrimaryPath,
    getJapaneseFontPath,
    escapeDrawtext,
    onProgress,
  });

  return target;
};
