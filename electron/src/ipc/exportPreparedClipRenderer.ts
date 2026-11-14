import { exportResourceContext } from './exportResourceContext';
import { qualifySilentFallback } from './exportFallbackQualification';
import { evaluateNativeFallback, NativeFallbackBudgetUnavailable } from '../nativeExport/nativeFallbackPolicy';
import type { NativeClipExporter } from '../nativeExport/nativeClipExport';
import { nativeClipEligibility } from '../nativeExport/nativeClipEligibility';
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
  signal?: AbortSignal,
): PreparedClipRenderer => {
  const selection = resolveExportSourceSelection(payload);
  const indexes = new Map(payload.clips.map((clip, index) => [clip, index]));
  return async (clip, outputPath, onProgress, stageEncoderOutput = false) => {
    signal?.throwIfAborted();
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
    const decision = !nativeExporter ? 'provider-unavailable'
      : !outputPath ? 'no-final-output'
      : selected.kind !== 'direct' ? 'prepared-source'
      : nativeClipEligibility(payload, clip, selection.useDual);
    if (process.env.SPORTAGLYTICS_EXPORT_DIAGNOSTICS === '1') {
      console.info('[export] Native eligibility', { decision });
    }
    let qualifyFallback = false;
    if (nativeExporter && outputPath && decision === 'eligible') {
      const result = await nativeExporter({
        sourcePath: selected.sourcePath,
        start: clip.startTime - selected.timeOrigin,
        duration: (clip.endTime - clip.startTime),
        audioTrack: clip.audioTrackIndex ?? 0,
        outputPath,
        signal,
      });
      if (result.status === 'completed') {
        onProgress?.(1);
        return outputPath;
      }
      signal?.throwIfAborted();
      const resources = exportResourceContext.getStore();
      if (resources) await resources.check();
      const fallback = evaluateNativeFallback(result.reason, !!resources);
      if (fallback.action === 'stop') throw new NativeFallbackBudgetUnavailable(fallback);
      qualifyFallback = result.reason === 'native-pre-output-unsupported';
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
    signal?.throwIfAborted();
    // Preserve temporary encoding for single/per-row fallback failures.
    if (stageEncoderOutput && outputPath) {
      await concatFiles(getFfmpegPath, [rendered], outputPath);
      if (qualifyFallback) await qualifySilentFallback(outputPath, clip.endTime - clip.startTime, signal);
      return outputPath;
    }
    if (qualifyFallback) await qualifySilentFallback(rendered, clip.endTime - clip.startTime, signal);
    return rendered;
  };
};
