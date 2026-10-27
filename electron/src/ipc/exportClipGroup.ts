import * as fs from 'node:fs/promises';
import type { ClipExportItem } from './exportHandlers.types';
import { concatFiles } from './exportFfmpegRunners';
import type { PreparedClipRenderer } from './exportPreparedClipRenderer';

interface ExportClipGroupOptions {
  clips: ClipExportItem[];
  outputPath: string;
  renderClip: PreparedClipRenderer;
  getFfmpegPath: () => string;
  getDuration: (clip: ClipExportItem) => number;
  onRenderStart: (index: number) => void;
  onRenderProgress: (fraction: number, duration: number, index: number) => void;
  onRendered: (duration: number, index: number) => void;
  onJoinStart: () => void;
  onJoinProgress: (fraction: number, duration: number) => void;
  onCompleted: (duration: number) => void;
}

/** A single final clip keeps publication inside its renderer's ownership. */
export const renderExportClipGroup = async (
  options: ExportClipGroupOptions,
): Promise<void> => {
  const { clips, outputPath } = options;
  if (!clips.length) throw new Error('No clips to export');
  const duration = clips.reduce(
    (sum, clip) => sum + options.getDuration(clip),
    0,
  );
  const temps: string[] = [];
  try {
    for (const [index, clip] of clips.entries()) {
      const clipDuration = options.getDuration(clip);
      options.onRenderStart(index);
      const rendered = await options.renderClip(
        clip,
        clips.length === 1 ? outputPath : undefined,
        (fraction) => options.onRenderProgress(fraction, clipDuration, index),
        clips.length === 1,
      );
      if (clips.length > 1) temps.push(rendered);
      options.onRendered(clipDuration, index);
    }
    if (clips.length > 1) {
      options.onJoinStart();
      await concatFiles(options.getFfmpegPath, temps, outputPath, {
        durationSeconds: duration,
        onProgress: (fraction) => options.onJoinProgress(fraction, duration),
      });
    }
    options.onCompleted(duration);
  } finally {
    await Promise.all(
      temps.map((file) => fs.unlink(file).catch(() => undefined)),
    );
  }
};
