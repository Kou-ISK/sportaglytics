import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageOpenPreparationResult } from '../../../src/types/package/migration';
import { isPlainObject } from './ipcPayloadGuards';
import { convertConfigToRelativePath } from './packageConfigMigrationService';

const MIGRATION_MARKER_FILE = 'legacy-migration.json';
const MIGRATION_SCHEMA_VERSION = 1;
const MAX_CONFLICT_SUFFIX = 999;

interface LegacyMigrationMarker {
  schemaVersion: number;
  sourceRealPath: string;
  sourceFingerprint: string;
  migratedAt: string;
}

const toPosixPath = (value: string): string => value.replace(/\\/g, '/');

const isPathInside = (parentPath: string, candidatePath: string): boolean => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
};

const normalizeStpkgPath = (targetPath: string): string =>
  targetPath.toLowerCase().endsWith('.stpkg')
    ? targetPath
    : `${targetPath}.stpkg`;

const readJson = async (filePath: string): Promise<unknown> => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as unknown;
};

const validatePackageFolder = async (packagePath: string): Promise<void> => {
  const stat = await fs.stat(packagePath);
  if (!stat.isDirectory()) {
    throw new Error('PACKAGE_SOURCE_NOT_DIRECTORY');
  }

  const configPath = path.join(packagePath, '.metadata', 'config.json');
  const timelinePath = path.join(packagePath, 'timeline.json');
  const config = await readJson(configPath);
  if (!isPlainObject(config)) {
    throw new Error('PACKAGE_CONFIG_INVALID');
  }
  await readJson(timelinePath);
};

const calculateSourceFingerprint = async (
  sourcePath: string,
): Promise<string> => {
  const [config, timeline] = await Promise.all([
    fs.readFile(path.join(sourcePath, '.metadata', 'config.json')),
    fs.readFile(path.join(sourcePath, 'timeline.json')),
  ]);
  const hash = createHash('sha256');
  hash.update('config\0');
  hash.update(config);
  hash.update('\0timeline\0');
  hash.update(timeline);
  return hash.digest('hex');
};

const readMigrationMarker = async (
  packagePath: string,
): Promise<LegacyMigrationMarker | null> => {
  try {
    const value = await readJson(
      path.join(packagePath, '.metadata', MIGRATION_MARKER_FILE),
    );
    if (
      !isPlainObject(value) ||
      value.schemaVersion !== MIGRATION_SCHEMA_VERSION ||
      typeof value.sourceRealPath !== 'string' ||
      typeof value.sourceFingerprint !== 'string' ||
      typeof value.migratedAt !== 'string'
    ) {
      return null;
    }
    return {
      schemaVersion: value.schemaVersion,
      sourceRealPath: value.sourceRealPath,
      sourceFingerprint: value.sourceFingerprint,
      migratedAt: value.migratedAt,
    };
  } catch {
    return null;
  }
};

const pathExists = async (candidatePath: string): Promise<boolean> => {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
};

const findReusableOrAvailableTarget = async ({
  sourceRealPath,
  sourceFingerprint,
  preferredTarget,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  preferredTarget: string;
}): Promise<{ targetPath: string; reusable: boolean }> => {
  const parsed = path.parse(preferredTarget);
  const baseName = parsed.name;

  for (let index = 0; index < MAX_CONFLICT_SUFFIX; index += 1) {
    const candidate =
      index === 0
        ? preferredTarget
        : path.join(parsed.dir, `${baseName}-${index + 1}.stpkg`);
    if (!(await pathExists(candidate))) {
      return { targetPath: candidate, reusable: false };
    }

    const marker = await readMigrationMarker(candidate);
    if (
      marker?.sourceRealPath === sourceRealPath &&
      marker.sourceFingerprint === sourceFingerprint
    ) {
      return { targetPath: candidate, reusable: true };
    }
  }

  throw new Error('PACKAGE_MIGRATION_TARGET_EXHAUSTED');
};

const resolveExplicitTarget = async ({
  sourceRealPath,
  sourceFingerprint,
  destinationPath,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  destinationPath: string;
}): Promise<{ targetPath: string; reusable: boolean }> => {
  const targetPath = path.resolve(normalizeStpkgPath(destinationPath));
  if (isPathInside(sourceRealPath, targetPath)) {
    throw new Error('PACKAGE_MIGRATION_TARGET_INSIDE_SOURCE');
  }
  if (!(await pathExists(targetPath))) {
    return { targetPath, reusable: false };
  }

  const marker = await readMigrationMarker(targetPath);
  if (
    marker?.sourceRealPath === sourceRealPath &&
    marker.sourceFingerprint === sourceFingerprint
  ) {
    return { targetPath, reusable: true };
  }
  throw new Error('PACKAGE_MIGRATION_TARGET_EXISTS');
};

const rewriteCopiedPath = async ({
  sourceRoot,
  copiedRoot,
  value,
}: {
  sourceRoot: string;
  copiedRoot: string;
  value: unknown;
}): Promise<unknown> => {
  if (typeof value !== 'string' || value.trim().length === 0) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (!path.isAbsolute(value)) return value;

  const resolved = path.resolve(value);
  if (!isPathInside(sourceRoot, resolved)) return value;
  const relative = path.relative(sourceRoot, resolved);
  const copiedCandidate = path.join(copiedRoot, relative);
  if (!(await pathExists(copiedCandidate))) return value;
  return toPosixPath(relative);
};

const rewriteCopiedConfigReferences = async (
  sourceRoot: string,
  copiedRoot: string,
): Promise<void> => {
  const configPath = path.join(copiedRoot, '.metadata', 'config.json');
  const config = await readJson(configPath);
  if (!isPlainObject(config)) {
    throw new Error('PACKAGE_CONFIG_INVALID');
  }

  config.tightViewPath = await rewriteCopiedPath({
    sourceRoot,
    copiedRoot,
    value: config.tightViewPath,
  });
  config.wideViewPath = await rewriteCopiedPath({
    sourceRoot,
    copiedRoot,
    value: config.wideViewPath,
  });

  if (Array.isArray(config.angles)) {
    for (const angle of config.angles) {
      if (!isPlainObject(angle)) continue;
      angle.relativePath = await rewriteCopiedPath({
        sourceRoot,
        copiedRoot,
        value: angle.relativePath,
      });
      if (!Array.isArray(angle.clips)) continue;
      for (const clip of angle.clips) {
        if (!isPlainObject(clip)) continue;
        clip.relativePath = await rewriteCopiedPath({
          sourceRoot,
          copiedRoot,
          value: clip.relativePath,
        });
      }
    }
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
};

const isPermissionError = (error: unknown): boolean => {
  if (!isPlainObject(error) || typeof error.code !== 'string') return false;
  return error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS';
};

const migrateLegacyFolder = async ({
  sourceRealPath,
  sourceFingerprint,
  targetPath,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  targetPath: string;
}): Promise<void> => {
  const temporaryPath = `${targetPath}.migrating-${process.pid}-${Date.now()}`;
  try {
    await fs.cp(sourceRealPath, temporaryPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    await rewriteCopiedConfigReferences(sourceRealPath, temporaryPath);

    const configMigration = await convertConfigToRelativePath(temporaryPath);
    if (!configMigration.success) {
      throw new Error(
        `PACKAGE_CONFIG_MIGRATION_FAILED:${configMigration.error ?? 'unknown'}`,
      );
    }

    await validatePackageFolder(temporaryPath);
    const marker: LegacyMigrationMarker = {
      schemaVersion: MIGRATION_SCHEMA_VERSION,
      sourceRealPath,
      sourceFingerprint,
      migratedAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(temporaryPath, '.metadata', MIGRATION_MARKER_FILE),
      JSON.stringify(marker, null, 2),
      'utf-8',
    );
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
};

export const preparePackageForOpen = async (
  sourcePath: string,
  destinationPath?: string,
): Promise<PackageOpenPreparationResult> => {
  const resolvedSource = path.resolve(sourcePath);
  await validatePackageFolder(resolvedSource);

  if (path.extname(resolvedSource).toLowerCase() === '.stpkg') {
    return {
      status: 'ready',
      packagePath: resolvedSource,
      migrated: false,
      reused: false,
    };
  }

  const sourceRealPath = await fs.realpath(resolvedSource);
  const sourceFingerprint = await calculateSourceFingerprint(sourceRealPath);
  const defaultTarget = path.join(
    path.dirname(sourceRealPath),
    `${path.basename(sourceRealPath)}.stpkg`,
  );

  const resolvedTarget = destinationPath
    ? await resolveExplicitTarget({
        sourceRealPath,
        sourceFingerprint,
        destinationPath,
      })
    : await findReusableOrAvailableTarget({
        sourceRealPath,
        sourceFingerprint,
        preferredTarget: defaultTarget,
      });

  if (resolvedTarget.reusable) {
    await validatePackageFolder(resolvedTarget.targetPath);
    return {
      status: 'ready',
      packagePath: resolvedTarget.targetPath,
      migrated: true,
      reused: true,
      sourcePath: sourceRealPath,
    };
  }

  try {
    await migrateLegacyFolder({
      sourceRealPath,
      sourceFingerprint,
      targetPath: resolvedTarget.targetPath,
    });
  } catch (error) {
    if (!destinationPath && isPermissionError(error)) {
      return {
        status: 'needs-destination',
        sourcePath: sourceRealPath,
        suggestedPath: defaultTarget,
      };
    }
    throw error;
  }

  return {
    status: 'ready',
    packagePath: resolvedTarget.targetPath,
    migrated: true,
    reused: false,
    sourcePath: sourceRealPath,
  };
};
