import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConvertConfigResult } from './packageTypes';
import { isPlainObject } from './ipcPayloadGuards';

const toPosixPath = (value: string) => value.replace(/\\/g, '/');

const tryResolveRelativePath = async (
  packageRoot: string,
  videosDir: string,
  value: string,
): Promise<string> => {
  const normalized = path.normalize(value);
  const resolved = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(packageRoot, normalized);

  const relativeFromPackage = path.relative(packageRoot, resolved);
  const isInsidePackage =
    relativeFromPackage &&
    !relativeFromPackage.startsWith('..') &&
    !path.isAbsolute(relativeFromPackage);

  if (isInsidePackage) {
    if (!resolved.startsWith(videosDir + path.sep)) {
      console.warn(
        `[convert-config] ${resolved} は videos フォルダ外です。構成を見直してください。`,
      );
    }
    return toPosixPath(relativeFromPackage);
  }

  const baseName = path.basename(resolved);
  const directCandidate = path.join(videosDir, baseName);

  try {
    await fs.promises.access(directCandidate, fs.constants.F_OK);
    const relative = path.relative(packageRoot, directCandidate);
    console.warn(`[convert-config] ${resolved} を ${relative} に更新します`);
    return toPosixPath(relative);
  } catch {
    // noop
  }

  try {
    const entries = await fs.promises.readdir(videosDir);
    const matched = entries.find(
      (entry) => entry.toLowerCase() === baseName.toLowerCase(),
    );
    if (matched) {
      const fallback = path.join(videosDir, matched);
      const relative = path.relative(packageRoot, fallback);
      console.warn(`[convert-config] ${resolved} を ${relative} に更新します`);
      return toPosixPath(relative);
    }
  } catch (scanError) {
    console.debug('videosフォルダの走査に失敗:', scanError);
  }

  console.warn(
    `[convert-config] ${resolved} はパッケージ外のため絶対パスのまま保持します`,
  );
  return toPosixPath(resolved);
};

const ensureRelativeVideoPath = async ({
  packageRoot,
  videosDir,
  value,
}: {
  packageRoot: string;
  videosDir: string;
  value: unknown;
}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }
  if (/^https:\/\//i.test(value.trim())) {
    return value.trim();
  }
  return tryResolveRelativePath(packageRoot, videosDir, value);
};

const writeConfigAtomically = async (
  configPath: string,
  content: string,
): Promise<void> => {
  const tempPath = `${configPath}.migration.tmp`;
  const backupPath = `${configPath}.migration-backup`;
  await fs.promises.writeFile(tempPath, content, 'utf-8');
  try {
    await fs.promises.rm(backupPath, { force: true });
    await fs.promises.rename(configPath, backupPath);
    await fs.promises.rename(tempPath, configPath);
    await fs.promises.rm(backupPath, { force: true });
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true });
    try {
      await fs.promises.access(backupPath, fs.constants.F_OK);
      await fs.promises.rm(configPath, { force: true });
      await fs.promises.rename(backupPath, configPath);
    } catch {
      // The original config was not moved yet.
    }
    throw error;
  }
};

export const convertConfigToRelativePath = async (
  packagePath: string,
): Promise<ConvertConfigResult> => {
  try {
    const configPath = path.join(packagePath, '.metadata', 'config.json');

    try {
      await fs.promises.access(configPath, fs.constants.F_OK);
    } catch {
      console.warn(
        `[convert-config-to-relative-path] config.json not found: ${configPath}`,
      );
      return {
        success: false,
        error: 'config.json not found',
      };
    }

    const raw = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw ?? '{}');

    const packageRoot = path.resolve(packagePath);
    const videosDir = path.join(packageRoot, 'videos');

    if (config.tightViewPath) {
      const converted = await ensureRelativeVideoPath({
        packageRoot,
        videosDir,
        value: config.tightViewPath,
      });
      if (converted !== config.tightViewPath) {
        config.tightViewPath = converted;
        console.log('tightViewPathを更新:', converted);
      }
    }

    if (config.wideViewPath) {
      const converted = await ensureRelativeVideoPath({
        packageRoot,
        videosDir,
        value: config.wideViewPath,
      });
      if (converted !== config.wideViewPath) {
        config.wideViewPath = converted;
        console.log('wideViewPathを更新:', converted);
      }
    }

    if (!Array.isArray(config.angles) || config.angles.length === 0) {
      const legacySources = [config.tightViewPath, config.wideViewPath].filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      );
      if (legacySources.length > 0) {
        config.angles = legacySources.map((source, index) => {
          const sourceKind = /^https:\/\//i.test(source) ? 'youtube' : 'local';
          const angleId = `legacy-angle-${index + 1}`;
          return {
            id: angleId,
            name: `Angle ${index + 1}`,
            role: index === 0 ? 'primary' : 'secondary',
            sourceKind,
            ...(sourceKind === 'youtube'
              ? { sourceUrl: source }
              : { relativePath: source }),
            clips: [
              {
                id: `${angleId}-clip-1`,
                sourceKind,
                ...(sourceKind === 'youtube'
                  ? { sourceUrl: source }
                  : { relativePath: source }),
                gapBeforeSeconds: 0,
                timelineStartSeconds: 0,
              },
            ],
          };
        });
        config.primaryAngleId = 'legacy-angle-1';
        if (legacySources.length > 1) {
          config.secondaryAngleId = 'legacy-angle-2';
        }
      }
    }

    if (Array.isArray(config.angles)) {
      for (const angle of config.angles) {
        if (!isPlainObject(angle)) {
          continue;
        }
        const angleRecord = angle;
        if (angleRecord.sourceKind !== 'youtube' && angleRecord.relativePath) {
          angleRecord.relativePath = await ensureRelativeVideoPath({
            packageRoot,
            videosDir,
            value: angleRecord.relativePath,
          });
        }
        if (!Array.isArray(angleRecord.clips)) continue;
        for (const clip of angleRecord.clips) {
          if (!isPlainObject(clip)) {
            continue;
          }
          const clipRecord = clip;
          if (clipRecord.sourceKind !== 'youtube' && clipRecord.relativePath) {
            clipRecord.relativePath = await ensureRelativeVideoPath({
              packageRoot,
              videosDir,
              value: clipRecord.relativePath,
            });
          }
        }

        // Packages created before virtual local playback keep an angle-level
        // rendered copy next to immutable source clips. Point the compatibility
        // path at the first source clip so old packages load through the same
        // runtime contract as newly created packages. The redundant file is
        // deliberately left in place; cleanup requires an explicit migration.
        if (angleRecord.sourceKind !== 'youtube') {
          const firstLocalClip = angleRecord.clips.find(
            (clip) =>
              isPlainObject(clip) &&
              clip.sourceKind !== 'youtube' &&
              typeof clip.relativePath === 'string',
          );
          if (isPlainObject(firstLocalClip)) {
            angleRecord.relativePath = firstLocalClip.relativePath;
          }
        }
      }

      const playableAngles = config.angles.filter(
        (angle: unknown) =>
          isPlainObject(angle) &&
          ((angle.sourceKind === 'youtube' &&
            typeof angle.sourceUrl === 'string') ||
            typeof angle.relativePath === 'string'),
      );
      const primaryAngle =
        playableAngles.find(
          (angle: unknown) =>
            isPlainObject(angle) && angle.id === config.primaryAngleId,
        ) ?? playableAngles[0];
      const secondaryAngle =
        playableAngles.find(
          (angle: unknown) =>
            isPlainObject(angle) && angle.id === config.secondaryAngleId,
        ) ?? playableAngles.find((angle: unknown) => angle !== primaryAngle);
      const getAngleSource = (angle: unknown): string | undefined => {
        if (!isPlainObject(angle)) return undefined;
        if (
          angle.sourceKind === 'youtube' &&
          typeof angle.sourceUrl === 'string'
        ) {
          return angle.sourceUrl;
        }
        return typeof angle.relativePath === 'string'
          ? angle.relativePath
          : undefined;
      };
      const primarySource = getAngleSource(primaryAngle);
      const secondarySource = getAngleSource(secondaryAngle);
      if (primarySource) {
        config.tightViewPath = primarySource;
      }
      if (secondarySource) {
        config.wideViewPath = secondarySource;
      }
    }

    const nextRaw = JSON.stringify(config, null, 2);
    if (raw.trim() !== nextRaw.trim()) {
      await writeConfigAtomically(configPath, nextRaw);
    }

    console.log('config.jsonを相対パスに変換しました:', configPath);
    return { success: true, config };
  } catch (error) {
    console.error('convert-config-to-relative-path error:', error);
    return { success: false, error: String(error) };
  }
};
