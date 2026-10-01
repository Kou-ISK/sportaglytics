import { MAX_PACKAGE_TIMELINE_CLIPS } from '../../../src/shared/media/packageMediaLimits';
import {
  isAbsoluteMediaReference,
  resolvePackageMediaPath,
} from '../../../src/shared/media/packageMediaPath';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateTimelineDocumentData } from '../../../src/shared/timeline/timelineValidation';
import { isPlainObject } from './ipcPayloadGuards';

const MAX_JSON_BYTES = 16 * 1024 * 1024;
export const PACKAGE_FORMAT_VERSION = 1;

export const readPackageJson = async (file: string): Promise<unknown> => {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_JSON_BYTES)
    throw new Error('PACKAGE_JSON_UNSAFE');
  return JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
};

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const validTime = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const mediaReference = (value: Record<string, unknown>): string => {
  if (value.sourceKind === 'youtube') {
    if (
      !isText(value.sourceUrl) ||
      !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(
        value.sourceUrl,
      )
    )
      throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
    return value.sourceUrl;
  }
  if (value.sourceKind !== undefined && value.sourceKind !== 'local')
    throw new Error('PACKAGE_MEDIA_KIND_UNSUPPORTED');
  if (!isText(value.relativePath))
    throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
  return value.relativePath;
};

export interface PackageCompatibility {
  needsMigration: boolean;
  missingMedia: string[];
}

/** Known structures are accepted independently of the filename extension. */
export const inspectPackageCompatibility = async (
  packagePath: string,
): Promise<PackageCompatibility> => {
  if (/\.(scpkg|sczip)$/i.test(packagePath))
    throw new Error('PACKAGE_SPORTSCODE_NATIVE_UNSUPPORTED');
  const stat = await fs.lstat(packagePath);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('PACKAGE_SOURCE_NOT_DIRECTORY');
  const rootRealPath = await fs.realpath(packagePath);
  const metadataStat = await fs.lstat(path.join(packagePath, '.metadata'));
  if (!metadataStat.isDirectory() || metadataStat.isSymbolicLink())
    throw new Error('PACKAGE_METADATA_UNSAFE');
  const config = await readPackageJson(
    path.join(packagePath, '.metadata/config.json'),
  );
  if (!isPlainObject(config)) throw new Error('PACKAGE_CONFIG_INVALID');
  for (const key of ['packageFormatVersion', 'schemaVersion']) {
    if (config[key] !== undefined && config[key] !== PACKAGE_FORMAT_VERSION)
      throw new Error('PACKAGE_VERSION_UNSUPPORTED');
  }
  const timeline = await readPackageJson(
    path.join(packagePath, 'timeline.json'),
  );
  try {
    validateTimelineDocumentData(timeline);
  } catch {
    throw new Error('PACKAGE_TIMELINE_INVALID');
  }
  let legacy = Array.isArray(timeline);
  const references: string[] = [];
  if (Array.isArray(config.angles) && config.angles.length > 0) {
    if (config.angles.length > 8) throw new Error('PACKAGE_ANGLE_LIMIT');
    const angleIds = new Set<string>();
    for (const angle of config.angles) {
      if (
        !isPlainObject(angle) ||
        !isText(angle.id) ||
        !isText(angle.name) ||
        angleIds.has(angle.id)
      )
        throw new Error('PACKAGE_ANGLES_INVALID');
      angleIds.add(angle.id);
      if (
        angle.clips === undefined ||
        (Array.isArray(angle.clips) && angle.clips.length === 0)
      ) {
        references.push(mediaReference(angle));
        legacy = true;
      } else {
        if (
          !Array.isArray(angle.clips) ||
          angle.clips.length === 0 ||
          angle.clips.length > MAX_PACKAGE_TIMELINE_CLIPS
        )
          throw new Error('PACKAGE_CLIPS_INVALID');
        const clipIds = new Set<string>();
        for (const clip of angle.clips) {
          if (
            !isPlainObject(clip) ||
            !isText(clip.id) ||
            clipIds.has(clip.id) ||
            !validTime(clip.gapBeforeSeconds) ||
            (clip.timelineStartSeconds !== undefined &&
              !validTime(clip.timelineStartSeconds)) ||
            (clip.durationSeconds !== undefined &&
              (!validTime(clip.durationSeconds) || clip.durationSeconds === 0))
          )
            throw new Error('PACKAGE_CLIPS_INVALID');
          clipIds.add(clip.id);
          references.push(mediaReference(clip));
        }
      }
    }
    for (const key of ['primaryAngleId', 'secondaryAngleId'])
      if (config[key] !== undefined && !angleIds.has(String(config[key])))
        throw new Error('PACKAGE_ANGLE_REFERENCE_INVALID');
  } else {
    legacy = true;
    for (const key of ['tightViewPath', 'wideViewPath']) {
      const value = config[key];
      if (value === undefined || value === null || value === '') continue;
      if (!isText(value)) throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
      references.push(value);
    }
    if (references.length === 0) throw new Error('PACKAGE_VIDEO_MISSING');
  }
  const missingMedia: string[] = [];
  for (const reference of new Set(references)) {
    if (/^https:\/\//i.test(reference)) {
      if (!/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(reference))
        throw new Error('PACKAGE_MEDIA_KIND_UNSUPPORTED');
      continue;
    }
    const absoluteReference = isAbsoluteMediaReference(reference);
    const resolved = path.resolve(
      resolvePackageMediaPath(packagePath, reference),
    );
    const relative = path.relative(packagePath, resolved);
    // External absolute references are retained exactly; no basename guessing.
    if (
      !absoluteReference &&
      (relative.startsWith('..') || path.isAbsolute(relative))
    )
      throw new Error('PACKAGE_MEDIA_REFERENCE_OUTSIDE');
    if (
      absoluteReference &&
      !relative.startsWith('..') &&
      !path.isAbsolute(relative)
    )
      legacy = true;
    try {
      const mediaStat = await fs.lstat(resolved);
      if (!absoluteReference) {
        const actual = await fs.realpath(resolved);
        const inside = path.relative(rootRealPath, actual);
        if (inside.startsWith('..') || path.isAbsolute(inside))
          throw new Error('PACKAGE_MEDIA_REFERENCE_OUTSIDE');
      }
      if (!mediaStat.isFile() || mediaStat.isSymbolicLink())
        throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        missingMedia.push(reference);
      else throw error;
    }
  }
  return {
    needsMigration:
      legacy || path.extname(packagePath).toLowerCase() !== '.stpkg',
    missingMedia,
  };
};
