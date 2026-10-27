import type { NativeClipExporter } from '../nativeExport/nativeClipExport';
import { canAttemptNativeClip } from '../nativeExport/nativeClipEligibility';
import type {
  ClipExportItem,
  ExportClipsPayload,
} from './exportHandlers.types';
import type { PreparedExportSources } from './exportSourcePreparation';
import { renderClipWithFfmpeg } from './exportClipRender';
import { concatFiles } from './exportFfmpegRunners';
import { resolveExportSourceSelection } from './exportSourceSelection';

export type PreparedClipRenderer = (
  clip: ClipExportItem,
  outputPath?: string,
  onProgress?: (progress: number) => void,
  stageEncoderOutput?: boolean,
) => Promise<string>;

/** Bind each instance and angle to its own original-file clock, even for reused files. */
export const createPreparedClipRenderer = (
  payload: ExportClipsPayload,
  prepared: PreparedExportSources,
  tempFiles: string[],
  getFfmpegPath: () => string,
  nativeExporter?: NativeClipExporter,
): PreparedClipRenderer => {
  const selection = resolveExportSourceSelection(payload);
  const indexes = new Map(payload.clips.map((clip, index) => [clip, index]));
  return async (clip, outputPath, onProgress, stageEncoderOutput = false) => {
    const index = indexes.get(clip);
    if (index === undefined)
      throw new Error('書き出し対象のクリップを確認してください');
    const sources = prepared.get(index);
    const resolveSource = (sourcePath: string) =>
      sources?.get(sourcePath) ?? { sourcePath, timeOrigin: 0, kind: 'direct' };
    const main = resolveSource(clip.videoSource || selection.mainSource);
    const secondaryPath = clip.videoSource2 || selection.secondarySource;
    const secondary = secondaryPath ? resolveSource(secondaryPath) : undefined;
    const selected =
      clip.angleType === 'angle2' && secondary ? secondary : main;
    if (
      nativeExporter &&
      outputPath &&
      selected.kind === 'direct' &&
      canAttemptNativeClip(payload, clip, selection.useDual)
    ) {
      const result = await nativeExporter({
        sourcePath: selected.sourcePath,
        start: clip.startTime - selected.timeOrigin,
        duration: Math.max(0.5, clip.endTime - clip.startTime),
        audioTrack: clip.audioTrackIndex ?? 0,
        outputPath,
      });
      if (result.status === 'completed') {
        onProgress?.(1);
        return outputPath;
      }
      console.info('[export] Native fallback', { reason: result.reason });
    }
    const rendered = await renderClipWithFfmpeg({
      getFfmpegPath,
      clip: {
        ...clip,
        videoSource: main.sourcePath,
        videoSource2: secondary?.sourcePath,
      },
      overlay: payload.overlay,
      mainSource: main.sourcePath,
      secondarySource: secondary?.sourcePath,
      useDual: selection.useDual,
      tempFiles,
      primaryTimeOrigin: main.timeOrigin,
      secondaryTimeOrigin: secondary?.timeOrigin,
      outputPath: stageEncoderOutput ? undefined : outputPath,
      onProgress,
    });
    // Preserve temporary encoding for single/per-row fallback failures.
    if (stageEncoderOutput && outputPath) {
      await concatFiles(getFfmpegPath, [rendered], outputPath);
      return outputPath;
    }
    return rendered;
  };
};
