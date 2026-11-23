import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeMeetingClip } from './exportMeetingSlide';
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
  const files: string[] = [];
  const meetingDir = clips.length > 1 && clips.some((clip) => clip.slideFrame)
    ? await fs.mkdtemp(join(tmpdir(), 'sportag-meeting-')) : undefined;
  try {
    for (const [index, clip] of clips.entries()) {
      const clipDuration = options.getDuration(clip);
      options.onRenderStart(index);
      const meetingPath = meetingDir ? join(meetingDir, index + '.mp4') : undefined;
      if (meetingPath) temps.push(meetingPath);
      const rendered = await options.renderClip(
        clip,
        clips.length === 1 ? outputPath : clip.slideFrame ? meetingPath : undefined,
        (fraction) => options.onRenderProgress(fraction, clipDuration, index),
        // Windows has no O_NOFOLLOW: write directly to the transaction's
        // exclusive staging path instead of using the unsupported safe copy.
        clips.length === 1 && process.platform !== 'win32',
      );
      if (clips.length > 1) {
        if (rendered !== meetingPath) temps.push(rendered);
        if (meetingPath && !clip.slideFrame) await normalizeMeetingClip(options.getFfmpegPath, rendered, meetingPath);
        files.push(meetingPath ?? rendered);
      }
      options.onRendered(clipDuration, index);
    }
    if (clips.length > 1) {
      options.onJoinStart();
      await concatFiles(options.getFfmpegPath, files, outputPath, {
        durationSeconds: duration,
        onProgress: (fraction) => options.onJoinProgress(fraction, duration),
      });
    }
    options.onCompleted(duration);
  } finally {
    await Promise.all(
      temps.map((file) => fs.unlink(file).catch(() => undefined)),
    );
    if (meetingDir) await fs.rmdir(meetingDir);
  }
};
