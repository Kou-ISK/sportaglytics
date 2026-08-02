import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageDatas } from '../../../src/renderer';
import { isPlainObject } from './ipcPayloadGuards';
import { probeMedia } from './packageMediaCompositionService';

export interface ClipTimelinePlacement {
  clipId: string;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

const resolveInsidePackage = (
  packagePath: string,
  relativePath: string,
): string => {
  const resolved = path.resolve(packagePath, relativePath);
  const prefix = `${path.resolve(packagePath)}${path.sep}`;
  if (!resolved.startsWith(prefix))
    throw new Error('INVALID_PACKAGE_MEDIA_PATH');
  return resolved;
};

export const applyClipTimeline = async (
  configPath: string,
  placements: ClipTimelinePlacement[],
): Promise<PackageDatas> => {
  const normalizedConfigPath = path.resolve(configPath);
  if (
    path.basename(normalizedConfigPath) !== 'config.json' ||
    path.basename(path.dirname(normalizedConfigPath)) !== '.metadata' ||
    !path.dirname(path.dirname(normalizedConfigPath)).endsWith('.stpkg')
  ) {
    throw new Error('INVALID_PACKAGE_CONFIG_PATH');
  }
  const packagePath = path.dirname(path.dirname(normalizedConfigPath));
  const parsed: unknown = JSON.parse(
    await fs.readFile(normalizedConfigPath, 'utf-8'),
  );
  if (!isPlainObject(parsed) || !Array.isArray(parsed.angles)) {
    throw new Error('INVALID_PACKAGE_CONFIG');
  }
  const placementMap = new Map(
    placements.map((placement) => [
      placement.clipId,
      placement.timelineStartSeconds,
    ]),
  );
  if (placementMap.size !== placements.length) {
    throw new Error('DUPLICATE_CLIP_PLACEMENT');
  }
  const nextConfig = structuredClone(parsed);
  if (!Array.isArray(nextConfig.angles)) throw new Error('INVALID_ANGLES');
  const knownClipIds = new Set(
    nextConfig.angles.flatMap((angleValue) =>
      isPlainObject(angleValue) && Array.isArray(angleValue.clips)
        ? angleValue.clips.flatMap((clipValue) =>
            isPlainObject(clipValue) && typeof clipValue.id === 'string'
              ? [clipValue.id]
              : [],
          )
        : [],
    ),
  );
  if ([...placementMap.keys()].some((clipId) => !knownClipIds.has(clipId))) {
    throw new Error('UNKNOWN_CLIP_PLACEMENT');
  }

  for (const angleValue of nextConfig.angles) {
    if (!isPlainObject(angleValue) || !Array.isArray(angleValue.clips))
      continue;
    const sourceKind: 'local' | 'youtube' =
      angleValue.sourceKind === 'youtube' ? 'youtube' : 'local';
    for (const clipValue of angleValue.clips) {
      if (!isPlainObject(clipValue) || typeof clipValue.id !== 'string')
        continue;
      const start = placementMap.get(clipValue.id);
      if (start !== undefined) {
        clipValue.timelineStartSeconds = start;
        const placement = placements.find(
          (candidate) => candidate.clipId === clipValue.id,
        );
        if (
          sourceKind === 'youtube' &&
          typeof placement?.durationSeconds === 'number'
        ) {
          clipValue.durationSeconds = placement.durationSeconds;
        }
      }
    }
    angleValue.clips.sort((left, right) => {
      const leftStart =
        isPlainObject(left) && typeof left.timelineStartSeconds === 'number'
          ? left.timelineStartSeconds
          : 0;
      const rightStart =
        isPlainObject(right) && typeof right.timelineStartSeconds === 'number'
          ? right.timelineStartSeconds
          : 0;
      return leftStart - rightStart;
    });
    let previousEnd = 0;
    for (const clipValue of angleValue.clips) {
      if (!isPlainObject(clipValue) || typeof clipValue.id !== 'string') {
        throw new Error('INVALID_CLIP_TIMELINE');
      }
      const start =
        typeof clipValue.timelineStartSeconds === 'number'
          ? clipValue.timelineStartSeconds
          : previousEnd;
      let duration =
        typeof clipValue.durationSeconds === 'number' &&
        Number.isFinite(clipValue.durationSeconds) &&
        clipValue.durationSeconds > 0
          ? clipValue.durationSeconds
          : undefined;
      if (sourceKind === 'local') {
        if (typeof clipValue.relativePath !== 'string') {
          throw new Error('INVALID_LOCAL_CLIP');
        }
        if (duration === undefined) {
          duration = (
            await probeMedia(
              resolveInsidePackage(packagePath, clipValue.relativePath),
            )
          ).durationSeconds;
        }
      }
      if (start < previousEnd - 0.001) {
        throw new Error('CLIP_TIMELINE_OVERLAP');
      }
      if (duration !== undefined && start + duration > 86_400) {
        throw new Error('CLIP_TIMELINE_OUT_OF_RANGE');
      }
      clipValue.timelineStartSeconds = start;
      clipValue.gapBeforeSeconds = Math.max(0, start - previousEnd);
      if (duration !== undefined) {
        clipValue.durationSeconds = duration;
      }
      // YouTube can still be positioned manually when the embed cannot
      // report its duration. The absolute start remains authoritative; once
      // the player reports a duration a later apply can validate the gap and
      // overlap precisely.
      previousEnd = start + (duration ?? 0);
    }
    if (sourceKind === 'local' && typeof angleValue.relativePath !== 'string') {
      const firstClip = angleValue.clips[0];
      if (
        isPlainObject(firstClip) &&
        typeof firstClip.relativePath === 'string'
      ) {
        angleValue.relativePath = firstClip.relativePath;
      }
    }
  }

  const configTempPath = `${normalizedConfigPath}.timeline.tmp`;
  const configBackupPath = `${normalizedConfigPath}.timeline-backup`;
  await fs.writeFile(configTempPath, JSON.stringify(nextConfig, null, 2));
  try {
    await fs.rm(configBackupPath, { force: true });
    await fs.rename(normalizedConfigPath, configBackupPath);
    await fs.rename(configTempPath, normalizedConfigPath);
    await fs.rm(configBackupPath, { force: true });
  } catch (error) {
    await fs.rm(configTempPath, { force: true });
    try {
      await fs.access(configBackupPath);
      await fs.rm(normalizedConfigPath, { force: true });
      await fs.rename(configBackupPath, normalizedConfigPath);
    } catch {
      // The config was not swapped yet.
    }
    throw error;
  }

  const angles = nextConfig.angles.flatMap((angleValue, index) => {
    if (!isPlainObject(angleValue) || !Array.isArray(angleValue.clips)) {
      return [];
    }
    const sourceKind: 'local' | 'youtube' =
      angleValue.sourceKind === 'youtube' ? 'youtube' : 'local';
    const role: 'primary' | 'secondary' | undefined =
      angleValue.role === 'primary' || angleValue.role === 'secondary'
        ? angleValue.role
        : undefined;
    const firstClip = angleValue.clips[0];
    const firstClipAbsolutePath = isPlainObject(firstClip)
      ? firstClip.sourceKind === 'youtube' &&
        typeof firstClip.sourceUrl === 'string'
        ? firstClip.sourceUrl
        : typeof firstClip.relativePath === 'string'
          ? resolveInsidePackage(packagePath, firstClip.relativePath)
          : ''
      : '';
    const absolutePath =
      firstClipAbsolutePath ||
      (sourceKind === 'youtube' && typeof angleValue.sourceUrl === 'string'
        ? angleValue.sourceUrl
        : typeof angleValue.relativePath === 'string'
          ? resolveInsidePackage(packagePath, angleValue.relativePath)
          : '');
    return [
      {
        id:
          typeof angleValue.id === 'string' ? angleValue.id : `angle-${index}`,
        name:
          typeof angleValue.name === 'string'
            ? angleValue.name
            : `Angle ${index + 1}`,
        role,
        absolutePath,
        relativePath:
          typeof angleValue.relativePath === 'string'
            ? angleValue.relativePath
            : undefined,
        sourceKind,
        sourceUrl:
          typeof angleValue.sourceUrl === 'string'
            ? angleValue.sourceUrl
            : undefined,
        clips: angleValue.clips.flatMap((clipValue) => {
          if (!isPlainObject(clipValue) || typeof clipValue.id !== 'string') {
            return [];
          }
          const clipSourceKind: 'local' | 'youtube' =
            clipValue.sourceKind === 'youtube' ? 'youtube' : 'local';
          return [
            {
              id: clipValue.id,
              sourceKind: clipSourceKind,
              relativePath:
                typeof clipValue.relativePath === 'string'
                  ? clipValue.relativePath
                  : undefined,
              sourceUrl:
                typeof clipValue.sourceUrl === 'string'
                  ? clipValue.sourceUrl
                  : undefined,
              gapBeforeSeconds:
                typeof clipValue.gapBeforeSeconds === 'number'
                  ? clipValue.gapBeforeSeconds
                  : 0,
              timelineStartSeconds:
                typeof clipValue.timelineStartSeconds === 'number'
                  ? clipValue.timelineStartSeconds
                  : 0,
              durationSeconds:
                typeof clipValue.durationSeconds === 'number'
                  ? clipValue.durationSeconds
                  : undefined,
            },
          ];
        }),
      },
    ];
  });
  return {
    timelinePath: path.join(packagePath, 'timeline.json'),
    tightViewPath: angles[0]?.absolutePath ?? '',
    wideViewPath: angles[1]?.absolutePath ?? null,
    angles,
    metaDataConfigFilePath: normalizedConfigPath,
  };
};
