import fs from 'node:fs/promises';
import path from 'node:path';
import { isPlainObject } from './ipcPayloadGuards';
import { readPackageJson } from './packageCompatibilityValidation';
export const MIGRATION_MARKER_FILE = 'legacy-migration.json';
export const MIGRATION_SCHEMA_VERSION = 1;
const MAX_CONFLICT_SUFFIX = 999;

export interface LegacyMigrationMarker {
  schemaVersion: number;
  sourceRealPath: string;
  sourceFingerprint: string;
  sourceRevision?: string;
  migratedAt: string;
}

export const isPathInside = (
  parentPath: string,
  candidatePath: string,
): boolean => {
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

export const readMigrationMarker = async (
  packagePath: string,
): Promise<LegacyMigrationMarker | null> => {
  try {
    const value = await readPackageJson(
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
      sourceRevision:
        typeof value.sourceRevision === 'string'
          ? value.sourceRevision
          : undefined,
      migratedAt: value.migratedAt,
    };
  } catch {
    return null;
  }
};

export const pathExists = async (candidatePath: string): Promise<boolean> => {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
};

export const findReusableOrAvailableTarget = async ({
  sourceRealPath,
  sourceFingerprint,
  sourceRevision,
  preferredTarget,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  sourceRevision?: string;
  preferredTarget: string;
}): Promise<{ targetPath: string; reusable: boolean }> => {
  const parsed = path.parse(preferredTarget);
  const baseName = parsed.name;

  const entries = new Set(await fs.readdir(parsed.dir));
  let available: string | undefined;
  for (let index = 0; index < MAX_CONFLICT_SUFFIX; index += 1) {
    const candidate =
      index === 0
        ? preferredTarget
        : path.join(parsed.dir, `${baseName}-${index + 1}.stpkg`);
    if (!entries.has(path.basename(candidate))) {
      available ??= candidate;
      continue;
    }

    const marker = await readMigrationMarker(candidate);
    if (
      marker?.sourceRealPath === sourceRealPath &&
      (marker.sourceRevision && sourceRevision
        ? marker.sourceRevision === sourceRevision
        : marker.sourceFingerprint === sourceFingerprint)
    ) {
      return { targetPath: candidate, reusable: true };
    }
  }

  if (available) return { targetPath: available, reusable: false };
  throw new Error('PACKAGE_MIGRATION_TARGET_EXHAUSTED');
};

export const resolveExplicitTarget = async ({
  sourceRealPath,
  sourceFingerprint,
  sourceRevision,
  destinationPath,
}: {
  sourceRealPath: string;
  sourceFingerprint: string;
  sourceRevision?: string;
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
    (marker.sourceRevision && sourceRevision
      ? marker.sourceRevision === sourceRevision
      : marker.sourceFingerprint === sourceFingerprint)
  ) {
    return { targetPath, reusable: true };
  }
  throw new Error('PACKAGE_MIGRATION_TARGET_EXISTS');
};
