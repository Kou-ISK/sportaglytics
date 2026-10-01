import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageOpenPreparationResult } from '../../../src/types/package/migration';
import { isPlainObject } from './ipcPayloadGuards';
import { convertConfigToRelativePath } from './packageConfigMigrationService';
import {
  inspectPackageCompatibility,
  PACKAGE_FORMAT_VERSION,
  readPackageJson,
} from './packageCompatibilityValidation';
import {
  snapshotPackageSource,
  checkMigrationCapacity,
} from './packageSourceSnapshot';
import { normalizeTimelineData } from '../../../src/utils/scTimelineConverter';

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

const readJson = readPackageJson;
const validatePackageFolder = inspectPackageCompatibility;
const calculateSourceFingerprint = async (
  sourcePath: string,
): Promise<string> => (await snapshotPackageSource(sourcePath)).fingerprint;

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

  const resolved = await fs.realpath(value);
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

  config.packageFormatVersion = PACKAGE_FORMAT_VERSION;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
};

const isPermissionError = (error: unknown): boolean => {
  if (!isPlainObject(error) || typeof error.code !== 'string') return false;
  return (
    error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS'
  );
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
  const temporaryPath = `${targetPath}.migrating-${randomUUID()}.stpkg`;
  const sourceSnapshot = await snapshotPackageSource(sourceRealPath);
  await checkMigrationCapacity(path.dirname(targetPath), sourceSnapshot.bytes);
  const parentRealPath = await fs.realpath(path.dirname(targetPath));
  if (isPathInside(sourceRealPath, parentRealPath))
    throw new Error('PACKAGE_MIGRATION_TARGET_INSIDE_SOURCE');
  try {
    await fs.cp(sourceRealPath, temporaryPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    for (const copied of [
      temporaryPath,
      path.join(temporaryPath, '.metadata'),
    ]) {
      const stat = await fs.stat(copied);
      await fs.chmod(copied, stat.mode | 0o700);
    }
    for (const copied of [
      path.join(temporaryPath, '.metadata/config.json'),
      path.join(temporaryPath, 'timeline.json'),
    ]) {
      const stat = await fs.stat(copied);
      await fs.chmod(copied, stat.mode | 0o600);
    }
    await rewriteCopiedConfigReferences(sourceRealPath, temporaryPath);

    const configMigration = await convertConfigToRelativePath(temporaryPath);
    if (!configMigration.success) {
      throw new Error(
        `PACKAGE_CONFIG_MIGRATION_FAILED:${configMigration.error ?? 'unknown'}`,
      );
    }

    const timelinePath = path.join(temporaryPath, 'timeline.json');
    const timeline = await readJson(timelinePath);
    if (Array.isArray(timeline)) {
      const instances = timeline.map(normalizeTimelineData);
      const rowNames = [...new Set(instances.map((item) => item.actionName))];
      const rows = rowNames.map((name, index) => ({
        id: `legacy-row-${index + 1}`,
        name,
        color:
          instances.find((item) => item.actionName === name)?.color ??
          '#4D8DFF',
      }));
      await fs.writeFile(
        timelinePath,
        JSON.stringify({ version: 2, rows, instances }),
        'utf8',
      );
    }
    const converted = await validatePackageFolder(temporaryPath);
    if (converted.needsMigration || converted.missingMedia.length)
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
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
    if (
      (await calculateSourceFingerprint(sourceRealPath)) !== sourceFingerprint
    )
      throw new Error('PACKAGE_SOURCE_CHANGED');
    if (await pathExists(targetPath))
      throw new Error('PACKAGE_MIGRATION_TARGET_EXISTS');
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
};

const preparePackage = async (
  sourcePath: string,
  destinationPath?: string,
): Promise<PackageOpenPreparationResult> => {
  const resolvedSource = path.resolve(sourcePath);
  const compatibility = await validatePackageFolder(resolvedSource);
  if (compatibility.missingMedia.length > 0)
    throw new Error('PACKAGE_MEDIA_MISSING');

  if (!compatibility.needsMigration) {
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
    path.extname(sourceRealPath).toLowerCase() === '.stpkg'
      ? `${path.parse(sourceRealPath).name}-migrated.stpkg`
      : `${path.basename(sourceRealPath)}.stpkg`,
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
    const reused = await validatePackageFolder(resolvedTarget.targetPath);
    if (reused.needsMigration || reused.missingMedia.length)
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
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

const preparations = new Map<string, Promise<PackageOpenPreparationResult>>();

export const preparePackageForOpen = async (
  sourcePath: string,
  destinationPath?: string,
): Promise<PackageOpenPreparationResult> => {
  const key = await fs.realpath(path.resolve(sourcePath));
  const preparation = (preparations.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => preparePackage(sourcePath, destinationPath));
  preparations.set(key, preparation);
  try {
    return await preparation;
  } finally {
    if (preparations.get(key) === preparation) preparations.delete(key);
  }
};
