import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeMeetingClip } from './exportMeetingSlide';
import { meetingAudioProfile, readMeetingAudio } from './meetingAudioProfile';
import type { MeetingAudioTrack } from './meetingAudioProfile';
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

/** Inspect the already selected angle and audio track before adding silent slides. */
const renderMeetingGroup = async (options: ExportClipGroupOptions, dir: string, temps: string[]): Promise<string[]> => {
  const { clips } = options;
  const media = new Map<number, { file: string; audio: MeetingAudioTrack | null }>();
  for (const [index, clip] of clips.entries()) {
    if (clip.slideFrame) continue;
    options.onRenderStart(index);
    const duration = options.getDuration(clip);
    const file = await options.renderClip(clip, undefined,
      (fraction) => options.onRenderProgress(fraction * 0.7, duration, index));
    temps.push(file);
    media.set(index, { file, audio: await readMeetingAudio(file) });
  }
  const profile = meetingAudioProfile([...media.values()].map((item) => item.audio));
  const outputFiles: string[] = [];
  for (const [index, clip] of clips.entries()) {
    const duration = options.getDuration(clip);
    const target = join(dir, index + '.mp4');
    temps.push(target);
    options.onRenderStart(index);
    const source = media.get(index);
    if (source) await normalizeMeetingClip(options.getFfmpegPath, source.file, target, source.audio, profile, duration);
    else await options.renderClip(clip, target, (fraction) => options.onRenderProgress(fraction, duration, index), false, profile);
    outputFiles.push(target);
    options.onRendered(duration, index);
  }
  return outputFiles;
};

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
  const meetingDir = clips.length > 1 && clips.some((clip) => clip.slideFrame)
    ? await fs.mkdtemp(join(tmpdir(), 'sportag-meeting-')) : undefined;
  try {
    const outputs = meetingDir ? await renderMeetingGroup(options, meetingDir, temps) : temps;
    if (!meetingDir) for (const [index, clip] of clips.entries()) {
      const clipDuration = options.getDuration(clip);
      options.onRenderStart(index);
      const rendered = await options.renderClip(
        clip,
        clips.length === 1 ? outputPath : undefined,
        (fraction) => options.onRenderProgress(fraction, clipDuration, index),
        // Windows has no O_NOFOLLOW: write directly to the transaction's
        // exclusive staging path instead of using the unsupported safe copy.
        clips.length === 1 && process.platform !== 'win32',
      );
      if (clips.length > 1) temps.push(rendered);
      options.onRendered(clipDuration, index);
    }
    if (clips.length > 1) {
      options.onJoinStart();
      await concatFiles(options.getFfmpegPath, outputs, outputPath, {
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
