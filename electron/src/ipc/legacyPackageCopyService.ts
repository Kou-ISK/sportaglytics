import { packageCopyDigest } from './packageCopyDigest';
import {
  MIGRATION_MARKER_FILE,
  MIGRATION_SCHEMA_VERSION,
  isPathInside,
  readMigrationMarker,
  pathExists,
  findReusableOrAvailableTarget,
  resolveExplicitTarget,
} from './packageMigrationTargets';
import type { LegacyMigrationMarker } from './packageMigrationTargets';
import type { PackageMigrationIndex } from './packageMigrationIndex';
import {
  isAbsoluteMediaReference,
  resolvePackageMediaPath,
} from '../../../src/shared/media/packageMediaPath';
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

const toPosixPath = (value: string): string => value.replace(/\\/g, '/');
const readJson = readPackageJson;
// Preserve the shipped 0.17.9 extension rule in this compatibility writer.
// Normal Open uses content detection plus historical-copy discovery instead.
const validatePackageFolder = async (
  source: string,
  staging = false,
): Promise<Awaited<ReturnType<typeof inspectPackageCompatibility>>> => {
  const result = await inspectPackageCompatibility(source, staging);
  return {
    ...result,
    needsMigration:
      result.needsMigration ||
      (!staging && path.extname(source).toLowerCase() !== '.stpkg'),
  };
};
const calculateSourceFingerprint = async (source: string): Promise<string> =>
  (await snapshotPackageSource(source)).fingerprint;

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
  if (!isAbsoluteMediaReference(value)) return value;

  const resolved = await fs.realpath(
    resolvePackageMediaPath(sourceRoot, value),
  );
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

export const migrateLegacyFolder = async ({
  sourceRealPath,
  sourceFingerprint,
  sourceRevision,
  targetPath,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  sourceRevision?: string;
  targetPath: string;
}): Promise<void> => {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.sportag-migrating-${randomUUID()}`,
  );
  const sourceSnapshot = await snapshotPackageSource(sourceRealPath);
  await checkMigrationCapacity(path.dirname(targetPath), sourceSnapshot.bytes);
  const parentRealPath = await fs.realpath(path.dirname(targetPath));
  if (isPathInside(sourceRealPath, parentRealPath))
    throw new Error('PACKAGE_MIGRATION_TARGET_INSIDE_SOURCE');
  const sourceDigest = await packageCopyDigest(sourceRealPath);
  try {
    await fs.cp(sourceRealPath, temporaryPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    if ((await packageCopyDigest(temporaryPath)) !== sourceDigest)
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
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
      const instances = timeline.map((item) =>
        normalizeTimelineData(item, 'legacy'),
      );
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
    const converted = await validatePackageFolder(temporaryPath, true);
    if (converted.needsMigration || converted.missingMedia.length)
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
    const marker: LegacyMigrationMarker = {
      schemaVersion: MIGRATION_SCHEMA_VERSION,
      sourceRealPath,
      sourceFingerprint,
      sourceRevision,
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

const rememberDestination = async (
  index: PackageMigrationIndex | undefined,
  source: string,
  revision: string,
  target: string,
): Promise<string | undefined> => {
  try {
    await index?.remember(source, revision, target);
    return undefined;
  } catch {
    return 'ファイルは開けましたが、この端末に保存先を記憶できませんでした。次回は完成したパッケージを直接開いてください。';
  }
};

const preparePackage = async (
  sourcePath: string,
  destinationPath?: string,
  index?: PackageMigrationIndex,
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
  const inventory = await snapshotPackageSource(sourceRealPath);
  const sourceFingerprint = inventory.fingerprint;
  const sourceRevision = inventory.revision;
  const defaultTarget = path.join(
    path.dirname(sourceRealPath),
    path.extname(sourceRealPath).toLowerCase() === '.stpkg'
      ? `${path.parse(sourceRealPath).name}-migrated.stpkg`
      : `${path.basename(sourceRealPath)}.stpkg`,
  );

  const registered = !destinationPath
    ? await index?.find(sourceRealPath, sourceRevision)
    : undefined;
  let rememberedTarget: { targetPath: string; reusable: boolean } | undefined;
  if (registered) {
    if (!(await pathExists(registered)))
      throw new Error('PACKAGE_MIGRATION_DESTINATION_UNAVAILABLE');
    const marker = await readMigrationMarker(registered);
    if (
      marker?.sourceRealPath !== sourceRealPath ||
      !(marker.sourceRevision
        ? marker.sourceRevision === sourceRevision
        : marker.sourceFingerprint === sourceFingerprint)
    )
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
    rememberedTarget = { targetPath: registered, reusable: true };
  }
  let resolvedTarget: { targetPath: string; reusable: boolean };
  try {
    resolvedTarget =
      rememberedTarget ??
      (destinationPath
        ? await resolveExplicitTarget({
            sourceRealPath,
            sourceFingerprint,
            sourceRevision,
            destinationPath,
          })
        : await findReusableOrAvailableTarget({
            sourceRealPath,
            sourceFingerprint,
            sourceRevision,
            preferredTarget: defaultTarget,
          }));
  } catch (error) {
    if (!destinationPath && isPermissionError(error))
      return {
        status: 'needs-destination',
        sourcePath: sourceRealPath,
        suggestedPath: defaultTarget,
      };
    throw error;
  }

  if (resolvedTarget.reusable) {
    const reused = await validatePackageFolder(resolvedTarget.targetPath);
    if (reused.needsMigration || reused.missingMedia.length)
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
    const warning = await rememberDestination(
      index,
      sourceRealPath,
      sourceRevision,
      resolvedTarget.targetPath,
    );
    return {
      status: 'ready',
      packagePath: resolvedTarget.targetPath,
      warning,
      migrated: true,
      reused: true,
      sourcePath: sourceRealPath,
    };
  }

  try {
    await migrateLegacyFolder({
      sourceRealPath,
      sourceFingerprint,
      sourceRevision,
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

  const warning = await rememberDestination(
    index,
    sourceRealPath,
    sourceRevision,
    resolvedTarget.targetPath,
  );
  return {
    status: 'ready',
    packagePath: resolvedTarget.targetPath,
    warning,
    migrated: true,
    reused: false,
    sourcePath: sourceRealPath,
  };
};

const preparations = new Map<string, Promise<PackageOpenPreparationResult>>();

export const prepareLegacyPackageCopy = async (
  sourcePath: string,
  destinationPath?: string,
  index?: PackageMigrationIndex,
): Promise<PackageOpenPreparationResult> => {
  const key = await fs.realpath(path.resolve(sourcePath));
  const preparation = (preparations.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => preparePackage(sourcePath, destinationPath, index));
  preparations.set(key, preparation);
  try {
    return await preparation;
  } finally {
    if (preparations.get(key) === preparation) preparations.delete(key);
  }
};
