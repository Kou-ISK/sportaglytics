import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { usesVirtualClipTimeline } from '../../../src/types/package/clipTimeline';
import { isPlainObject } from './ipcPayloadGuards';
import { recomposeLocalTimeline } from './packageMediaCompositionService';

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

export const materializeVirtualTimelineForExport = async (
  sourcePath: string,
  tempFiles: string[],
): Promise<string> => {
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  const packagePath = findPackageRoot(sourcePath);
  if (!packagePath) return sourcePath;

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await fs.readFile(
        path.join(packagePath, '.metadata', 'config.json'),
        'utf-8',
      ),
    );
  } catch {
    return sourcePath;
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.angles)) {
    return sourcePath;
  }
  const normalizedSource = path.resolve(sourcePath);
  const angle = parsed.angles.find((value) => {
    if (!isPlainObject(value) || value.sourceKind === 'youtube') return false;
    const anglePath =
      typeof value.relativePath === 'string'
        ? resolveInsidePackage(packagePath, value.relativePath)
        : '';
    if (anglePath && path.resolve(anglePath) === normalizedSource) return true;
    return (
      Array.isArray(value.clips) &&
      value.clips.some(
        (clip) =>
          isPlainObject(clip) &&
          typeof clip.relativePath === 'string' &&
          path.resolve(resolveInsidePackage(packagePath, clip.relativePath)) ===
            normalizedSource,
      )
    );
  });
  if (!isPlainObject(angle) || !Array.isArray(angle.clips)) return sourcePath;

  const clips = angle.clips.map((clip) => {
    if (
      !isPlainObject(clip) ||
      typeof clip.id !== 'string' ||
      typeof clip.relativePath !== 'string'
    ) {
      throw new Error('INVALID_LOCAL_CLIP');
    }
    return {
      id: clip.id,
      sourcePath: resolveInsidePackage(packagePath, clip.relativePath),
      timelineStartSeconds:
        typeof clip.timelineStartSeconds === 'number'
          ? clip.timelineStartSeconds
          : undefined,
      gapBeforeSeconds:
        typeof clip.gapBeforeSeconds === 'number' ? clip.gapBeforeSeconds : 0,
    };
  });
  if (
    !usesVirtualClipTimeline(
      clips.map((clip) => ({
        timelineStartSeconds: clip.timelineStartSeconds ?? 0,
      })),
    )
  ) {
    return sourcePath;
  }

  const outputPath = path.join(
    os.tmpdir(),
    `sportaglytics-export-timeline-${randomUUID()}.mp4`,
  );
  await recomposeLocalTimeline(clips, outputPath);
  tempFiles.push(outputPath);
  return outputPath;
};
