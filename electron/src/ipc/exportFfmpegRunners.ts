import { resolveMediaCopyMode } from './exportStreamCopy';
import {
  prepareChromaForeground,
  restoreChromaForeground,
} from './exportChroma';
import { overlayMotion } from './exportMotionOverlays';
import { insertFreeze, overlayFreeze } from './exportFreezeFrames';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import {
  concatFfmpegFiles,
  type FfmpegProcessProgressOptions,
} from './exportFfmpegProcess';
import { H264_ENCODER_ARGS } from '../mediaTools';

export type { ExportClipForFfmpeg, OverlayLine } from './exportFfmpegCommon';
export { runFfmpegDual } from './exportFfmpegDual';
import {
  runWithOptionalProgress,
  type RunSingleParams,
} from './exportFfmpegCommon';

const canUseStreamCopyForSingle = ({
  overlayEnabled,
  annotationPath,
  clip,
}: Pick<
  RunSingleParams,
  'overlayEnabled' | 'annotationPath' | 'clip'
>): boolean => {
  const hasFreeze =
    clip.freezeAt !== null &&
    clip.freezeAt !== undefined &&
    (clip.freezeDuration ?? 0) > 0;
  return (
    !overlayEnabled &&
    !annotationPath &&
    !hasFreeze &&
    !clip.freezeFrames?.length &&
    !clip.motionOverlays?.length
  );
};

export const runFfmpegSingle = async ({
  getFfmpegPath,
  sourcePath,
  clip,
  outputPath,
  overlayEnabled,
  overlayLines,
  annotationPath,
  getJapaneseFontPath,
  escapeDrawtext,
  onProgress,
}: RunSingleParams): Promise<void> => {
  const actualSource = clip.sourceOverride || sourcePath;
  const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);

  const copyMode = canUseStreamCopyForSingle({
    overlayEnabled,
    annotationPath,
    clip,
  })
    ? await resolveMediaCopyMode(actualSource, clip.startTime, clipDuration)
    : null;
  if (copyMode === 'whole-file') {
    // Remux arbitrary source containers to MP4 without cutting AAC priming or video frames.
    await runWithOptionalProgress(
      getFfmpegPath,
      [
        '-n',
        '-copyts',
        '-i',
        actualSource,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-c',
        'copy',
        '-avoid_negative_ts',
        'disabled',
        outputPath,
      ],
      clipDuration,
      onProgress,
    );
    return;
  }
  if (copyMode === 'keyframe-range') {
    await runWithOptionalProgress(
      getFfmpegPath,
      [
        '-n',
        '-ss',
        String(clip.startTime),
        '-i',
        actualSource,
        '-t',
        String(clipDuration),
        '-map',
        '0:v',
        '-map',
        '0:a?',
        '-c',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        outputPath,
      ],
      clipDuration,
      onProgress,
    );
    return;
  }

  const vfTexts = overlayEnabled
    ? buildOverlayFilters({
        overlayLines,
        getJapaneseFontPath,
        escapeDrawtext,
        variant: 'single',
      })
    : [];

  const filterSteps: string[] = [];
  let baseLabel = '[0:v]';
  let mapLabel = '0:v';
  let audioMap = '0:a?';
  const inputArgs = [
    '-n',
    '-ss',
    String(clip.startTime),
    '-t',
    String(clipDuration),
    '-i',
    actualSource,
  ];

  filterSteps.push(
    `[0:v]trim=duration=${clipDuration},setpts=PTS-STARTPTS[vtrim]`,
  );
  filterSteps.push(
    clip.hasAudio === false
      ? `anullsrc=r=48000:cl=stereo,atrim=duration=${clipDuration}[atrim]`
      : `[0:a]atrim=duration=${clipDuration},asetpts=PTS-STARTPTS[atrim]`,
  );
  baseLabel = '[vtrim]';
  mapLabel = '[vtrim]';
  audioMap = '[atrim]';
  baseLabel = prepareChromaForeground(
    filterSteps,
    baseLabel,
    clip.chromaKey?.primary,
    'chroma',
  );
  const motion = overlayMotion(
    filterSteps,
    inputArgs,
    baseLabel,
    clip.motionOverlays ?? [],
    'primary',
    1,
  );
  baseLabel = restoreChromaForeground(
    filterSteps,
    motion.label,
    clip.chromaKey?.primary,
    'chroma',
  );

  const frames =
    clip.freezeFrames ??
    (clip.freezeAt != null
      ? [
          {
            time: clip.freezeAt,
            duration: clip.freezeDuration ?? 0,
            primary: annotationPath,
          },
        ]
      : []);
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  let insertedDuration = 0;
  for (const [index, frame] of ordered.entries()) {
    if (frame.duration <= 0) continue;
    const time =
      Math.max(0, Math.min(frame.time, clipDuration)) + insertedDuration;
    baseLabel = insertFreeze(
      filterSteps,
      baseLabel,
      time,
      frame.duration,
      `f${index}v`,
    );
    audioMap = insertFreeze(
      filterSteps,
      audioMap,
      time,
      frame.duration,
      `f${index}a`,
      true,
    );
    insertedDuration += frame.duration;
  }
  let imageIndex = motion.inputIndex;
  insertedDuration = 0;
  for (const [index, frame] of ordered.entries()) {
    const time =
      Math.max(0, Math.min(frame.time, clipDuration)) + insertedDuration;
    const result = overlayFreeze(
      filterSteps,
      inputArgs,
      baseLabel,
      frame.primary,
      imageIndex,
      time,
      frame.duration,
      `ann${index}`,
    );
    baseLabel = result.label;
    imageIndex = result.inputIndex;
    insertedDuration += Math.max(0, frame.duration);
  }
  // Legacy annotations without a freeze retain their full-clip overlay.
  if (!frames.length && annotationPath) {
    baseLabel = overlayFreeze(
      filterSteps,
      inputArgs,
      baseLabel,
      annotationPath,
      imageIndex,
      0,
      clipDuration,
      'ann',
    ).label;
  }
  mapLabel = baseLabel;

  if (vfTexts.length) {
    filterSteps.push(`${baseLabel}${vfTexts.join(',')}[vout]`);
    mapLabel = '[vout]';
  }

  const args = [...inputArgs];
  if (filterSteps.length) {
    args.push('-filter_complex', filterSteps.join(';'), '-map', mapLabel);
  } else {
    args.push('-map', '0:v');
  }

  args.push(...H264_ENCODER_ARGS, '-c:a', 'aac', '-map', audioMap, outputPath);

  const durationSeconds = clipDuration + insertedDuration;
  await runWithOptionalProgress(
    getFfmpegPath,
    args,
    durationSeconds,
    onProgress,
  );
};

export const concatFiles = async (
  getFfmpegPath: () => string,
  files: string[],
  outputPath: string,
  progressOptions?: FfmpegProcessProgressOptions,
): Promise<void> => {
  await concatFfmpegFiles(getFfmpegPath, files, outputPath, progressOptions);
};
