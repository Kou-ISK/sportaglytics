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
      outputPath,
      onProgress,
    });
  };
};
