import { spawn } from 'child_process';
import * as fs from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface ExportClipForFfmpeg {
  startTime: number;
  endTime: number;
  freezeAt?: number | null;
  freezeDuration?: number;
  sourceOverride?: string;
  secondarySourceOverride?: string;
}

export interface OverlayLine {
  text: string;
  isBold: boolean;
}

interface RunSingleParams {
  getFfmpegPath: () => string;
  sourcePath: string;
  clip: ExportClipForFfmpeg;
  outputPath: string;
  overlayEnabled: boolean;
  overlayLines: OverlayLine[];
  annotationPath?: string | null;
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
}

interface RunDualParams {
  getFfmpegPath: () => string;
  mainSource: string;
  secondarySource?: string | null;
  clip: ExportClipForFfmpeg;
  outputPath: string;
  overlayEnabled: boolean;
  overlayLines: OverlayLine[];
  annotationPrimary?: string | null;
  annotationSecondary?: string | null;
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
}

export const runFfmpegSingle = ({
  getFfmpegPath,
  sourcePath,
  clip,
  outputPath,
  overlayEnabled,
  overlayLines,
  annotationPath,
  getJapaneseFontPath,
  escapeDrawtext,
}: RunSingleParams): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const vfTexts: string[] = [];
    if (overlayEnabled) {
      const totalDisplayLines = overlayLines.reduce((acc, line) => {
        const lineCount = (line.text.match(/\n/g) || []).length + 1;
        return acc + lineCount;
      }, 0);

      const boxHeight = Math.max(60, 60 + (totalDisplayLines - 1) * 35);
      const box = `drawbox=x=0:y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@0.7:t=fill`;
      vfTexts.push(box);

      const linesConfig = [
        {
          color: 'white',
          size: 34,
          y: `h-${boxHeight - 25}`,
          isBold: true,
        },
        {
          color: '#dcdcdc',
          size: 28,
          y: `h-${Math.max(30, boxHeight - 60)}`,
          isBold: false,
        },
        {
          color: '#bbbbbb',
          size: 24,
          y: `h-${Math.max(30, boxHeight - 90)}`,
          isBold: false,
        },
      ];

      overlayLines.forEach((line, idx) => {
        const safeText = escapeDrawtext(line.text);
        const cfg = linesConfig[idx] ?? linesConfig[linesConfig.length - 1];

        let fontParam = '';
        try {
          const fontPath = getJapaneseFontPath(line.isBold);
          fontParam = `fontfile='${fontPath}':`;
        } catch {
          fontParam = '';
        }

        const text = `drawtext=${fontParam}text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=0:shadowcolor=black@0.55:shadowx=2:shadowy=2:x=20:y=${cfg.y}`;
        vfTexts.push(text);
      });
    }

    const filterSteps: string[] = [];
    let baseLabel = '[0:v]';
    let mapLabel = '0:v';
    let audioMap = '0:a?';
    const actualSource = clip.sourceOverride || sourcePath;
    const inputArgs = ['-y', '-i', actualSource];

    const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);

    filterSteps.push(
      `[0:v]trim=start=${clip.startTime}:end=${clip.endTime},setpts=PTS-STARTPTS[vtrim]`,
    );
    filterSteps.push(
      `[0:a]atrim=start=${clip.startTime}:end=${clip.endTime},asetpts=PTS-STARTPTS[atrim]`,
    );
    baseLabel = '[vtrim]';
    mapLabel = '[vtrim]';
    audioMap = '[atrim]';

    const freezeAt =
      clip.freezeAt !== null && clip.freezeAt !== undefined
        ? Math.max(0, Math.min(clip.freezeAt, clipDuration))
        : null;
    const freezeDuration = clip.freezeDuration ?? 0;

    if (freezeAt !== null && freezeDuration > 0) {
      filterSteps.push(`${baseLabel}split[vpre][vpost]`);
      filterSteps.push(
        `[vpre]trim=end=${freezeAt},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${freezeDuration}[vprepad]`,
      );
      filterSteps.push(
        `[vpost]trim=start=${freezeAt},setpts=PTS-STARTPTS[vpostshift]`,
      );
      filterSteps.push(`[vprepad][vpostshift]concat=n=2:v=1:a=0[vfreeze]`);
      baseLabel = '[vfreeze]';
      mapLabel = baseLabel;

      filterSteps.push(`${audioMap}asplit[apre][apost]`);
      filterSteps.push(
        `[apre]atrim=end=${freezeAt},asetpts=PTS-STARTPTS,apad=pad_dur=${freezeDuration}[aprepad]`,
      );
      filterSteps.push(
        `[apost]atrim=start=${freezeAt},asetpts=PTS-STARTPTS[apostshift]`,
      );
      filterSteps.push(`[aprepad][apostshift]concat=n=2:v=0:a=1[afreeze]`);
      audioMap = '[afreeze]';
    }

    if (annotationPath) {
      inputArgs.push('-i', annotationPath);
      const enableExpr =
        freezeAt !== null && freezeDuration > 0
          ? `:enable='between(t,${freezeAt},${freezeAt + freezeDuration})'`
          : '';
      filterSteps.push('[1:v]format=rgba[ovrraw]');
      filterSteps.push(`[ovrraw]${baseLabel}scale2ref[ovr][bbase]`);
      filterSteps.push(`[bbase][ovr]overlay=0:0${enableExpr}[vanno]`);
      baseLabel = '[vanno]';
      mapLabel = baseLabel;
    }

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

    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-map',
      audioMap,
      outputPath,
    );

    const ff = spawn(getFfmpegPath(), args);
    ff.stderr.on('data', (data) => {
      console.log('[ffmpeg]', data.toString());
    });
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
};

export const runFfmpegDual = ({
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
}: RunDualParams): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const actualMainSource = clip.sourceOverride || mainSource;
    const actualSecondarySource = clip.secondarySourceOverride || secondarySource;
    if (!actualSecondarySource) {
      reject(new Error('2画面結合に必要な第2ソースがありません'));
      return;
    }

    const filterSteps: string[] = [];
    let mainLabel = '[0:v]';
    let subLabel = '[1:v]';
    let audioMap = '0:a?';
    const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);
    const freezePos =
      clip.freezeAt !== null && clip.freezeAt !== undefined
        ? Math.max(0, Math.min(clip.freezeAt, clipDuration))
        : null;
    const freezeDur = clip.freezeDuration ?? 0;

    const inputs = ['-y', '-i', actualMainSource, '-i', actualSecondarySource];
    let currentInputIndex = 2;

    filterSteps.push(
      `[0:v]trim=start=${clip.startTime}:end=${clip.endTime},setpts=PTS-STARTPTS[mtrim]`,
    );
    filterSteps.push(
      `[0:a]atrim=start=${clip.startTime}:end=${clip.endTime},asetpts=PTS-STARTPTS[atrim]`,
    );
    filterSteps.push(
      `[1:v]trim=start=${clip.startTime}:end=${clip.endTime},setpts=PTS-STARTPTS[strim]`,
    );

    mainLabel = '[mtrim]';
    subLabel = '[strim]';
    audioMap = '[atrim]';

    if (freezePos !== null && freezeDur > 0) {
      filterSteps.push(`${mainLabel}split[mvpre][mvpost]`);
      filterSteps.push(
        `[mvpre]trim=end=${freezePos},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${freezeDur}[mvprepad]`,
      );
      filterSteps.push(
        `[mvpost]trim=start=${freezePos},setpts=PTS-STARTPTS[mvpostshift]`,
      );
      filterSteps.push(`[mvprepad][mvpostshift]concat=n=2:v=1:a=0[mvfreeze]`);
      mainLabel = '[mvfreeze]';

      filterSteps.push(`${audioMap}asplit[apre][apost]`);
      filterSteps.push(
        `[apre]atrim=end=${freezePos},asetpts=PTS-STARTPTS,apad=pad_dur=${freezeDur}[aprepad]`,
      );
      filterSteps.push(
        `[apost]atrim=start=${freezePos},asetpts=PTS-STARTPTS[apostshift]`,
      );
      filterSteps.push(`[aprepad][apostshift]concat=n=2:v=0:a=1[afreeze]`);
      audioMap = '[afreeze]';
    }

    if (freezePos !== null && freezeDur > 0) {
      filterSteps.push(`${subLabel}split[svpre][svpost]`);
      filterSteps.push(
        `[svpre]trim=end=${freezePos},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${freezeDur}[svprepad]`,
      );
      filterSteps.push(
        `[svpost]trim=start=${freezePos},setpts=PTS-STARTPTS[svpostshift]`,
      );
      filterSteps.push(`[svprepad][svpostshift]concat=n=2:v=1:a=0[svfreeze]`);
      subLabel = '[svfreeze]';
    }

    if (annotationPrimary) {
      inputs.push('-i', annotationPrimary);
      const enableExpr =
        freezePos !== null && freezeDur > 0
          ? `:enable='between(t,${freezePos},${freezePos + freezeDur})'`
          : '';
      filterSteps.push(`[${currentInputIndex}:v]format=rgba[ovpraw]`);
      filterSteps.push(`[ovpraw]${mainLabel}scale2ref[ovp][mbase]`);
      filterSteps.push(`[mbase][ovp]overlay=0:0${enableExpr}[vp]`);
      mainLabel = '[vp]';
      currentInputIndex += 1;
    }

    if (annotationSecondary) {
      inputs.push('-i', annotationSecondary);
      const enableExpr =
        freezePos !== null && freezeDur > 0
          ? `:enable='between(t,${freezePos},${freezePos + freezeDur})'`
          : '';
      filterSteps.push(`[${currentInputIndex}:v]format=rgba[ovsraw]`);
      filterSteps.push(`[ovsraw]${subLabel}scale2ref[ovs][sbase]`);
      filterSteps.push(`[sbase][ovs]overlay=0:0${enableExpr}[vs]`);
      subLabel = '[vs]';
      currentInputIndex += 1;
    }

    filterSteps.push(`${mainLabel}${subLabel}hstack=inputs=2[vbase]`);

    if (overlayEnabled) {
      const overlayFilters: string[] = [];
      const totalDisplayLines = overlayLines.reduce((acc, line) => {
        const lineCount = (line.text.match(/\n/g) || []).length + 1;
        return acc + lineCount;
      }, 0);

      const boxHeight = Math.max(60, 60 + (totalDisplayLines - 1) * 35);
      const box = `drawbox=x=0:y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@0.7:t=fill`;
      overlayFilters.push(box);

      const linesConfig = [
        {
          color: 'white',
          size: 34,
          y: `h-${boxHeight - 25}`,
          isBold: true,
        },
        {
          color: '#dcdcdc',
          size: 28,
          y: `h-${Math.max(30, boxHeight - 60)}`,
          isBold: false,
        },
        {
          color: '#bbbbbb',
          size: 24,
          y: `h-${Math.max(30, boxHeight - 90)}`,
          isBold: false,
        },
      ];

      overlayLines.forEach((line, idx) => {
        const safeText = escapeDrawtext(line.text);
        const cfg = linesConfig[idx] ?? linesConfig[linesConfig.length - 1];

        let fontParam = '';
        try {
          const fontPath = getJapaneseFontPath(line.isBold);
          fontParam = `fontfile='${fontPath}':`;
        } catch {
          fontParam = '';
        }

        const text = `drawtext=${fontParam}text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=0:bordercolor=black@0.0:x=20:y=${cfg.y}`;
        overlayFilters.push(text);
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
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      outputPath,
    ];

    const ff = spawn(getFfmpegPath(), args);
    ff.stderr.on('data', (data) => console.log('[ffmpeg]', data.toString()));
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
};

export const concatFiles = async (
  getFfmpegPath: () => string,
  files: string[],
  outputPath: string,
): Promise<void> => {
  const listPath = path.join(
    os.tmpdir(),
    `concat_${Date.now()}_${Math.random()}.txt`,
  );
  const content = files
    .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fs.writeFile(listPath, content, 'utf-8');

  return new Promise<void>((resolve, reject) => {
    const ff = spawn(getFfmpegPath(), [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-fflags',
      '+genpts',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      outputPath,
    ]);
    ff.stderr.on('data', (data) => console.log('[ffmpeg]', data.toString()));
    ff.on('close', async (code) => {
      await fs.unlink(listPath).catch(() => undefined);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
};
