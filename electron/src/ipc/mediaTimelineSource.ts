import { MAX_PACKAGE_TIMELINE_CLIPS } from '../../../src/shared/media/packageMediaLimits';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  MediaTimeline,
  MediaTimelineClip,
} from '../../../src/shared/media/mediaTimeline';
import { getAngleOffset } from '../../../src/shared/media/mediaTimeline';
import { isPlainObject, normalizeSyncDataPayload } from './ipcPayloadGuards';
import { probeMedia } from './packageMediaCompositionService';

const findPackageRoot = (sourcePath: string): string | null => {
  let current = path.resolve(sourcePath);
  while (true) {
    const parent = path.dirname(current);
    if (current.toLowerCase().endsWith('.stpkg')) return current;
    if (parent === current) return null;
    current = parent;
  }
};

const resolveInsidePackage = (
  packagePath: string,
  relativePath: string,
): string => {
  const resolved = path.resolve(packagePath, relativePath);
  const prefix = `${path.resolve(packagePath)}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error('INVALID_PACKAGE_MEDIA_PATH');
  }
  return resolved;
};

/** Resolve the current package contract for both playback and export, without persisting a copy. */
export const readMediaTimeline = async (
  sourcePath: string,
  requireDurations = false,
): Promise<MediaTimeline | null> => {
  if (/^https?:\/\//i.test(sourcePath)) return null;
  const packagePath = findPackageRoot(sourcePath);
  if (!packagePath) return null;
  const parsed: unknown = JSON.parse(
    await fs.readFile(
      path.join(packagePath, '.metadata', 'config.json'),
      'utf8',
    ),
  );
  if (!isPlainObject(parsed) || !Array.isArray(parsed.angles)) return null;
  const normalizedSource = path.resolve(sourcePath);
  const angleIndex = parsed.angles.findIndex((value) => {
    if (!isPlainObject(value) || value.sourceKind === 'youtube') return false;
    if (
      typeof value.relativePath === 'string' &&
      resolveInsidePackage(packagePath, value.relativePath) === normalizedSource
    )
      return true;
    return (
      Array.isArray(value.clips) &&
      value.clips.some(
        (clip) =>
          isPlainObject(clip) &&
          typeof clip.relativePath === 'string' &&
          resolveInsidePackage(packagePath, clip.relativePath) ===
            normalizedSource,
      )
    );
  });
  if (angleIndex < 0) return null;
  const angle: unknown = parsed.angles[angleIndex];
  if (!isPlainObject(angle)) return null;
  const rawClips =
    Array.isArray(angle.clips) && angle.clips.length
      ? angle.clips
      : [
          {
            id: 'legacy-source',
            relativePath: angle.relativePath,
            timelineStartSeconds: 0,
          },
        ];
  if (rawClips.length > MAX_PACKAGE_TIMELINE_CLIPS)
    throw new Error('INVALID_MEDIA_TIMELINE');
  const clips: MediaTimelineClip[] = [];
  const ids = new Set<string>();
  let previousEnd = 0;
  for (const raw of rawClips) {
    if (
      !isPlainObject(raw) ||
      typeof raw.id !== 'string' ||
      ids.has(raw.id) ||
      typeof raw.relativePath !== 'string'
    )
      throw new Error('INVALID_MEDIA_CLIP');
    ids.add(raw.id);
    const source = resolveInsidePackage(packagePath, raw.relativePath);
    const duration =
      typeof raw.durationSeconds === 'number'
        ? raw.durationSeconds
        : requireDurations
          ? (await probeMedia(source)).durationSeconds
          : undefined;
    const start =
      typeof raw.timelineStartSeconds === 'number'
        ? raw.timelineStartSeconds
        : previousEnd +
          (typeof raw.gapBeforeSeconds === 'number' ? raw.gapBeforeSeconds : 0);
    if (
      !Number.isFinite(start) ||
      start < 0 ||
      start > 86400 ||
      (duration !== undefined &&
        (!Number.isFinite(duration) ||
          duration <= 0 ||
          start + duration > 86400))
    )
      throw new Error('INVALID_MEDIA_TIMELINE');
    clips.push({
      id: raw.id,
      source,
      timelineStartSeconds: start,
      durationSeconds: duration,
    });
    previousEnd = start + (duration ?? 0);
  }
  clips.sort((a, b) => a.timelineStartSeconds - b.timelineStartSeconds);
  for (let index = 1; index < clips.length; index++) {
    const previous = clips[index - 1];
    if (
      previous.durationSeconds !== undefined &&
      clips[index].timelineStartSeconds <
        previous.timelineStartSeconds + previous.durationSeconds - 0.001
    )
      throw new Error('CLIP_TIMELINE_OVERLAP');
  }
  const sync = normalizeSyncDataPayload(parsed.syncData) ?? undefined;
  return { clips, offsetSeconds: getAngleOffset(sync, angleIndex) };
};
