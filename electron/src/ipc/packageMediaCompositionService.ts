import * as fs from 'node:fs';
import * as path from 'node:path';
import { getFfprobePath } from '../mediaTools';
import type {
  NormalizedAngle,
  PackageAnglePayload,
  PackageClipPayload,
} from './packageTypes';
import { deriveTimelineGaps } from '../../../src/types/package/clipTimeline';
import { runMediaProcess } from './mediaProcessRunner';

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

export const probeMedia = async (filePath: string): Promise<MediaProbe> => {
  const result = await runMediaProcess(
    getFfprobePath(),
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath],
    { timeoutMs: 30_000, maxOutputBytes: 1024 * 1024 },
  );
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
