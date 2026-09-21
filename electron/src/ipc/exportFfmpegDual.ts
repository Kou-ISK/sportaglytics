import { probeMedia } from './packageMediaCompositionService';
import {
  prepareChromaForeground,
  restoreChromaForeground,
} from './exportChroma';
import { overlayMotion } from './exportMotionOverlays';
import { insertFreeze, overlayFreeze } from './exportFreezeFrames';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import { H264_ENCODER_ARGS } from '../mediaTools';
import {
  runWithOptionalProgress,
  type RunDualParams,
} from './exportFfmpegCommon';

export const runFfmpegDual = async ({
  getFfmpegPath,
  mainSource,
  secondarySource,
  clip,
  outputPath,
  overlayEnabled,
  overlayLines,
  annotationPrimary,
  annotationSecondary,
  getJapaneseFontPath,
  escapeDrawtext,
  onProgress,
}: RunDualParams): Promise<void> => {
  const sizes = overlayEnabled
    ? await Promise.all([
        probeMedia(clip.sourceOverride || mainSource),
        probeMedia(
          clip.secondarySourceOverride || secondarySource || mainSource,
        ),
      ])
    : [];
  const outputHeight = sizes[0] ? sizes[0].height - (sizes[0].height % 2) : 1;
  const aspectRatio =
    sizes.reduce(
      (sum, size) =>
        sum + 2 * Math.floor((outputHeight * size.width) / size.height / 2),
      0,
    ) / outputHeight;
  return new Promise<void>((resolve, reject) => {
    const actualMainSource = clip.sourceOverride || mainSource;
    const actualSecondarySource =
      clip.secondarySourceOverride || secondarySource;
    if (!actualSecondarySource) {
      reject(new Error('2画面結合に必要な第2ソースがありません'));
      return;
    }

    const filterSteps: string[] = [];
    let mainLabel = '[0:v]';
    let subLabel = '[1:v]';
    let audioMap = '0:a?';
    const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);
    const inputs = [
      '-n',
      '-ss',
      String(clip.startTime),
      '-t',
      String(clipDuration),
      '-i',
      actualMainSource,
      '-ss',
      String(clip.secondaryStartTime ?? clip.startTime),
      '-t',
      String(clipDuration),
      '-i',
      actualSecondarySource,
    ];
    let currentInputIndex = 2;

    filterSteps.push(
      `[0:v]trim=duration=${clipDuration},setpts=PTS-STARTPTS[mtrim]`,
    );
    filterSteps.push(
      clip.hasAudio === false
        ? `anullsrc=r=48000:cl=stereo,atrim=duration=${clipDuration}[atrim]`
        : `[0:a]atrim=duration=${clipDuration},asetpts=PTS-STARTPTS[atrim]`,
    );
    filterSteps.push(
      `[1:v]trim=duration=${clipDuration},setpts=PTS-STARTPTS[strim]`,
    );

    mainLabel = '[mtrim]';
    subLabel = '[strim]';
    audioMap = '[atrim]';
    mainLabel = prepareChromaForeground(
      filterSteps,
      mainLabel,
      clip.chromaKey?.primary,
      'chromaP',
    );
    subLabel = prepareChromaForeground(
      filterSteps,
      subLabel,
      clip.chromaKey?.secondary,
      'chromaS',
    );
    const mainMotion = overlayMotion(
      filterSteps,
      inputs,
      mainLabel,
      clip.motionOverlays ?? [],
      'primary',
      currentInputIndex,
    );
    mainLabel = restoreChromaForeground(
      filterSteps,
      mainMotion.label,
      clip.chromaKey?.primary,
      'chromaP',
    );
    const subMotion = overlayMotion(
      filterSteps,
      inputs,
      subLabel,
      clip.motionOverlays ?? [],
      'secondary',
      mainMotion.inputIndex,
    );
    subLabel = restoreChromaForeground(
      filterSteps,
      subMotion.label,
      clip.chromaKey?.secondary,
      'chromaS',
    );
    currentInputIndex = subMotion.inputIndex;

    const frames =
      clip.freezeFrames ??
      (clip.freezeAt != null
        ? [
            {
              time: clip.freezeAt,
              duration: clip.freezeDuration ?? 0,
              primary: annotationPrimary,
              secondary: annotationSecondary,
            },
          ]
        : []);
    const ordered = [...frames].sort((a, b) => a.time - b.time);
    let insertedDuration = 0;
    for (const [index, frame] of ordered.entries()) {
      if (frame.duration <= 0) continue;
      const time =
        Math.max(0, Math.min(frame.time, clipDuration)) + insertedDuration;
      mainLabel = insertFreeze(
        filterSteps,
        mainLabel,
        time,
        frame.duration,
        `f${index}m`,
      );
      subLabel = insertFreeze(
        filterSteps,
        subLabel,
        time,
        frame.duration,
        `f${index}s`,
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
    insertedDuration = 0;
    for (const [index, frame] of ordered.entries()) {
      const time =
        Math.max(0, Math.min(frame.time, clipDuration)) + insertedDuration;
      const primary = overlayFreeze(
        filterSteps,
        inputs,
        mainLabel,
        frame.primary,
        currentInputIndex,
        time,
        frame.duration,
        `p${index}`,
      );
      mainLabel = primary.label;
      currentInputIndex = primary.inputIndex;
      const secondary = overlayFreeze(
        filterSteps,
        inputs,
        subLabel,
        frame.secondary,
        currentInputIndex,
        time,
        frame.duration,
        `s${index}`,
      );
      subLabel = secondary.label;
      currentInputIndex = secondary.inputIndex;
      insertedDuration += Math.max(0, frame.duration);
    }
    if (!frames.length) {
      const primary = overlayFreeze(
        filterSteps,
        inputs,
        mainLabel,
        annotationPrimary,
        currentInputIndex,
        0,
        clipDuration,
        'p',
      );
      mainLabel = primary.label;
      currentInputIndex = primary.inputIndex;
      subLabel = overlayFreeze(
        filterSteps,
        inputs,
        subLabel,
        annotationSecondary,
        currentInputIndex,
        0,
        clipDuration,
        's',
      ).label;
    }

    // Composite Paint in each source's coordinates before matching display heights.
    filterSteps.push(
      `${mainLabel}scale=w='trunc(iw*sar/2)*2':h='trunc(ih/2)*2',setsar=1[mnormal]`,
    );
    filterSteps.push(
      `${subLabel}[mnormal]scale2ref=w='trunc(oh*mdar/2)*2':h=ih[snormal][mref]`,
    );
    filterSteps.push('[mref][snormal]hstack=inputs=2,setsar=1[vbase]');

    if (overlayEnabled) {
      const overlayFilters = buildOverlayFilters({
        overlayLines,
        getJapaneseFontPath,
        escapeDrawtext,
        variant: 'dual',
        aspectRatio,
      });
      filterSteps.push(`[vbase]${overlayFilters.join(',')}[vout]`);
    } else {
      filterSteps.push('[vbase]null[vout]');
    }

    const args = [
      ...inputs,
      '-filter_complex',
      filterSteps.join(';'),
      '-map',
      '[vout]',
      '-map',
      audioMap,
      ...H264_ENCODER_ARGS,
      '-c:a',
      'aac',
      outputPath,
    ];

    const durationSeconds = clipDuration + insertedDuration;
    runWithOptionalProgress(getFfmpegPath, args, durationSeconds, onProgress)
      .then(resolve)
      .catch(reject);
  });
};
