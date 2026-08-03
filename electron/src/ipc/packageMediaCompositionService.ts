import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getFfmpegPath, getFfprobePath } from '../mediaTools';
import type {
  NormalizedAngle,
  PackageAnglePayload,
  PackageClipPayload,
} from './packageTypes';
import { deriveTimelineGaps } from '../../../src/types/package/clipTimeline';

interface MediaProbe {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

interface ProbeOutput {
  format?: { duration?: string };
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
  }>;
}

const isProbeOutput = (value: unknown): value is ProbeOutput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = Object.fromEntries(Object.entries(value));
  return record.streams === undefined || Array.isArray(record.streams);
};

const resolveBinaryPath = (binaryPath: string): string =>
  process.env.NODE_ENV === 'production'
    ? binaryPath.replace('app.asar', 'app.asar.unpacked')
    : binaryPath;

const runProcess = async (
  executable: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> =>
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(`Media process failed (${code ?? 'unknown'}): ${stderr}`),
      );
    });
  });

export const probeMedia = async (filePath: string): Promise<MediaProbe> => {
  const result = await runProcess(resolveBinaryPath(getFfprobePath()), [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    filePath,
  ]);
  const parsed: unknown = JSON.parse(result.stdout);
  if (!isProbeOutput(parsed)) {
    throw new Error(
      `映像情報を取得できませんでした: ${path.basename(filePath)}`,
    );
  }
  const output = parsed;
  const video = output.streams?.find((stream) => stream.codec_type === 'video');
  const durationSeconds = Number(output.format?.duration);
  if (!video || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`有効な映像ではありません: ${path.basename(filePath)}`);
  }
  return {
    durationSeconds,
    width: video.width && video.width > 0 ? video.width : 1920,
    height: video.height && video.height > 0 ? video.height : 1080,
    hasAudio: Boolean(
      output.streams?.some((stream) => stream.codec_type === 'audio'),
    ),
  };
};

const sanitizeSegment = (value: string, fallback: string): string => {
  const sanitized = value.trim().replace(/[\\/:*?"<>|]/g, '_');
  return sanitized || fallback;
};

const isYoutubeUrl = (value: string): boolean =>
  /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value.trim());

const copyClipSources = async (
  angle: PackageAnglePayload,
  videosDir: string,
): Promise<
  Array<PackageClipPayload & { copiedPath: string; relativePath: string }>
> => {
  const sourceDirectory = path.join(
    videosDir,
    'sources',
    sanitizeSegment(angle.id, 'angle'),
  );
  await fs.promises.mkdir(sourceDirectory, { recursive: true });

  return await Promise.all(
    angle.clips.map(async (clip, index) => {
      if (clip.sourceKind !== 'local') {
        throw new Error(
          'ローカル映像と YouTube は同じアングル内で混在できません。',
        );
      }
      if (!/\.(?:mp4|mov|m4v|webm)$/i.test(clip.source)) {
        throw new Error(
          `対応していない映像形式です: ${path.basename(clip.source)}`,
        );
      }
      await fs.promises.access(clip.source, fs.constants.R_OK);
      const extension = path.extname(clip.source) || '.mp4';
      const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeSegment(
        path.basename(clip.source, extension),
        'clip',
      )}${extension}`;
      const copiedPath = path.join(sourceDirectory, fileName);
      await fs.promises.copyFile(clip.source, copiedPath);
      return {
        ...clip,
        copiedPath,
        relativePath: path
          .relative(path.dirname(videosDir), copiedPath)
          .replace(/\\/g, '/'),
      };
    }),
  );
};

const composeLocalClips = async (
  clips: Array<
    PackageClipPayload & {
      copiedPath: string;
      durationSeconds: number;
      timelineStartSeconds: number;
    }
  >,
  outputPath: string,
): Promise<void> => {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not found');
  }
  const probes = await Promise.all(
    clips.map((clip) => probeMedia(clip.copiedPath)),
  );
  const targetWidth = Math.max(2, probes[0].width - (probes[0].width % 2));
  const targetHeight = Math.max(2, probes[0].height - (probes[0].height % 2));
  const filters: string[] = [];

  clips.forEach((clip, index) => {
    const previous = index > 0 ? clips[index - 1] : undefined;
    const previousEnd = previous
      ? previous.timelineStartSeconds + previous.durationSeconds
      : 0;
    const gap = Math.max(0, clip.timelineStartSeconds - previousEnd);
    const probe = probes[index];
    filters.push(
      `[${index}:v:0]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,tpad=start_mode=add:start_duration=${gap},setpts=PTS-STARTPTS[v${index}]`,
    );
    if (probe.hasAudio) {
      filters.push(
        `[${index}:a:0]aresample=48000,apad,atrim=duration=${probe.durationSeconds},adelay=${Math.round(gap * 1000)}:all=1[a${index}]`,
      );
    } else {
      filters.push(
        `anullsrc=r=48000:cl=stereo,atrim=duration=${probe.durationSeconds + gap}[a${index}]`,
      );
    }
  });
  const concatInputs = clips
    .map((_, index) => `[v${index}][a${index}]`)
    .join('');
  filters.push(`${concatInputs}concat=n=${clips.length}:v=1:a=1[outv][outa]`);

  const inputArgs = clips.flatMap((clip) => ['-i', clip.copiedPath]);
  await runProcess(resolveBinaryPath(ffmpegPath), [
    '-y',
    ...inputArgs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
};

export const recomposeLocalTimeline = async (
  clips: Array<{
    id: string;
    sourcePath: string;
    timelineStartSeconds?: number;
    gapBeforeSeconds?: number;
  }>,
  outputPath: string,
): Promise<
  Array<{
    id: string;
    sourcePath: string;
    timelineStartSeconds: number;
    durationSeconds: number;
    gapBeforeSeconds: number;
  }>
> => {
  const probedWithLegacyFields = await Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      durationSeconds: (await probeMedia(clip.sourcePath)).durationSeconds,
    })),
  );
  let legacyCursor = 0;
  const probed = probedWithLegacyFields.map((clip) => {
    const timelineStartSeconds =
      typeof clip.timelineStartSeconds === 'number'
        ? clip.timelineStartSeconds
        : legacyCursor + Math.max(0, clip.gapBeforeSeconds ?? 0);
    legacyCursor = timelineStartSeconds + clip.durationSeconds;
    return { ...clip, timelineStartSeconds };
  });
  const derived = deriveTimelineGaps(probed);
  if (derived.overlap) {
    throw new Error(
      `CLIP_TIMELINE_OVERLAP:${derived.overlap.previousClipId}:${derived.overlap.clipId}`,
    );
  }
  const byId = new Map(probed.map((clip) => [clip.id, clip]));
  const placed = derived.clips.map((clip) => {
    const original = byId.get(clip.id);
    if (!original) throw new Error('CLIP_SOURCE_NOT_FOUND');
    return {
      id: clip.id,
      sourcePath: original.sourcePath,
      copiedPath: original.sourcePath,
      sourceKind: 'local' as const,
      source: original.sourcePath,
      timelineStartSeconds: clip.timelineStartSeconds,
      durationSeconds: clip.durationSeconds,
      gapBeforeSeconds: clip.gapBeforeSeconds,
    };
  });
  await composeLocalClips(placed, outputPath);
  return placed.map(
    ({ copiedPath: _copiedPath, source: _source, ...clip }) => ({
      id: clip.id,
      sourcePath: clip.sourcePath,
      timelineStartSeconds: clip.timelineStartSeconds,
      durationSeconds: clip.durationSeconds,
      gapBeforeSeconds: clip.gapBeforeSeconds,
    }),
  );
};

export const materializePackageAngle = async (
  angle: PackageAnglePayload,
  angleIndex: number,
  _packageName: string,
  videosDir: string,
): Promise<NormalizedAngle> => {
  const name = sanitizeSegment(angle.name, `Angle ${angleIndex + 1}`);
  const youtubeClips = angle.clips.filter(
    (clip) => clip.sourceKind === 'youtube',
  );
  if (youtubeClips.length > 0) {
    if (
      youtubeClips.length !== angle.clips.length ||
      !youtubeClips.every((clip) => isYoutubeUrl(clip.source))
    ) {
      throw new Error(
        '同じアングル内でローカル映像とYouTubeは混在できません。',
      );
    }
    let timelineCursor = 0;
    const normalizedYoutubeClips = youtubeClips.map((clip) => {
      const timelineStartSeconds =
        typeof clip.timelineStartSeconds === 'number'
          ? clip.timelineStartSeconds
          : timelineCursor + Math.max(0, clip.gapBeforeSeconds);
      const previousEnd = timelineCursor;
      timelineCursor =
        timelineStartSeconds + Math.max(0, clip.durationSeconds ?? 0);
      return {
        id: clip.id,
        sourceKind: 'youtube' as const,
        sourceUrl: clip.source.trim(),
        gapBeforeSeconds: Math.max(0, timelineStartSeconds - previousEnd),
        timelineStartSeconds,
        durationSeconds: clip.durationSeconds,
      };
    });
    return {
      id: angle.id,
      name,
      role: angle.role,
      sourceKind: 'youtube',
      sourceUrl: normalizedYoutubeClips[0].sourceUrl,
      absolutePath: normalizedYoutubeClips[0].sourceUrl,
      clips: normalizedYoutubeClips,
    };
  }

  const copiedClips = await copyClipSources(angle, videosDir);
  const probes = await Promise.all(
    copiedClips.map((clip) => probeMedia(clip.copiedPath)),
  );
  let timelineCursor = 0;
  const placedClips = copiedClips.map((clip, index) => {
    const durationSeconds = probes[index].durationSeconds;
    const previousEnd = timelineCursor;
    const timelineStartSeconds =
      typeof clip.timelineStartSeconds === 'number' &&
      Number.isFinite(clip.timelineStartSeconds) &&
      clip.timelineStartSeconds >= 0
        ? clip.timelineStartSeconds
        : timelineCursor + clip.gapBeforeSeconds;
    timelineCursor = timelineStartSeconds + durationSeconds;
    return {
      ...clip,
      durationSeconds,
      timelineStartSeconds,
      gapBeforeSeconds: Math.max(0, timelineStartSeconds - previousEnd),
    };
  });
  const derived = deriveTimelineGaps(placedClips);
  if (derived.overlap) {
    throw new Error(
      `CLIP_TIMELINE_OVERLAP:${derived.overlap.previousClipId}:${derived.overlap.clipId}`,
    );
  }
  const firstClip = placedClips[0];
  if (!firstClip) {
    throw new Error('LOCAL_ANGLE_REQUIRES_CLIP');
  }
  return {
    id: angle.id,
    name,
    role: angle.role,
    sourceKind: 'local',
    // The angle-level path is a compatibility/fallback pointer only. Playback
    // resolves the active source clip from the virtual timeline at runtime.
    relativePath: firstClip.relativePath,
    absolutePath: firstClip.copiedPath,
    clips: placedClips.map((clip, index) => {
      const previous = index > 0 ? placedClips[index - 1] : undefined;
      const previousEnd = previous
        ? previous.timelineStartSeconds + previous.durationSeconds
        : 0;
      return {
        id: clip.id,
        sourceKind: 'local',
        relativePath: clip.relativePath,
        absolutePath: clip.copiedPath,
        gapBeforeSeconds: Math.max(0, clip.timelineStartSeconds - previousEnd),
        timelineStartSeconds: clip.timelineStartSeconds,
        durationSeconds: clip.durationSeconds,
      };
    }),
  };
};
