import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import type { NativeClipExporter } from '../nativeExport/nativeClipExport';
import { canAttemptNativeClip } from '../nativeExport/nativeClipEligibility';
import type {
  ClipExportItem,
  ExportClipsPayload,
} from './exportHandlers.types';
import type { PreparedExportSources } from './exportSourcePreparation';
import { renderClipWithFfmpeg } from './exportClipRender';
import { resolveExportSourceSelection } from './exportSourceSelection';

type PreparedClipRenderer = (
  clip: ClipExportItem,
  outputPath?: string,
  onProgress?: (progress: number) => void,
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
  return async (clip, outputPath, onProgress) => {
    const index = indexes.get(clip);
    if (index === undefined)
      throw new Error('書き出し対象のクリップを確認してください');
    const sources = prepared.get(index);
    const resolveSource = (sourcePath: string) =>
      sources?.get(sourcePath) ?? { sourcePath, timeOrigin: 0 };
    const main = resolveSource(clip.videoSource || selection.mainSource);
    const secondaryPath = clip.videoSource2 || selection.secondarySource;
    const secondary = secondaryPath ? resolveSource(secondaryPath) : undefined;
    let target = outputPath;
    if (
      nativeExporter &&
      canAttemptNativeClip(payload, clip, selection.useDual)
    ) {
      const source =
        clip.angleType === 'angle2' && secondary ? secondary : main;
      target ??= path.join(os.tmpdir(), `clip_${randomUUID()}.mp4`);
      if (!outputPath) tempFiles.push(target);
      const result = await nativeExporter({
        sourcePath: source.sourcePath,
        start: clip.startTime - source.timeOrigin,
        duration: Math.max(0.5, clip.endTime - clip.startTime),
        audioTrack: clip.audioTrackIndex ?? 0,
        outputPath: target,
      });
      if (result.status === 'completed') {
        onProgress?.(1);
        return target;
      }
      console.info('[export] Native fallback', { reason: result.reason });
    }
    return renderClipWithFfmpeg({
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
      outputPath: target,
      onProgress,
    });
  };
};
