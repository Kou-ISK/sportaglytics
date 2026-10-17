import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectPackageCompatibility } from './packageCompatibilityValidation';
import { readMigrationMarker } from './packageMigrationTargets';
import type { PackageMigrationIndex } from './packageMigrationIndex';
import { snapshotPackageSource } from './packageSourceSnapshot';
import { samePackagePath, strictPathExists } from './packageUpdateJournal';

export interface PackageContentChoice {
  source: string;
  candidates: string[];
  reason: 'untracked' | 'conflict' | 'unavailable';
}
export type ChoosePackageContent = (
  choice: PackageContentChoice,
) => Promise<string | null>;

export const collectPreviousPackageCopies = async (
  source: string,
  index?: PackageMigrationIndex,
): Promise<Set<string>> => {
  const registered = (await index?.listForSource(source)) ?? [];
  const candidates = new Set(registered.map((entry) => entry.target));
  const entries = await fs.readdir(path.dirname(source), {
    withFileTypes: true,
  });
  if (entries.length > 10_000) throw new Error('PACKAGE_TOO_MANY_FILES');
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = path.join(path.dirname(source), entry.name);
    if (samePackagePath(candidate, source)) continue;
    const marker = await readMigrationMarker(candidate);
    if (marker && samePackagePath(marker.sourceRealPath, source))
      candidates.add(candidate);
  }
  return candidates;
};

export const choosePackageMigrationContent = async (
  source: string,
  index?: PackageMigrationIndex,
  choose?: ChoosePackageContent,
): Promise<string> => {
  const inventory = await snapshotPackageSource(source);
  const candidates = await collectPreviousPackageCopies(source, index);
  const valid: string[] = [];
  let unavailable = false;
  let diverged = false;
  for (const candidate of candidates) {
    if (samePackagePath(candidate, source)) continue;
    if (!(await strictPathExists(candidate))) {
      unavailable = true;
      continue;
    }
    const marker = await readMigrationMarker(candidate);
    if (!marker || !samePackagePath(marker.sourceRealPath, source)) {
      unavailable = true;
      continue;
    }
    try {
      const compatibility = await inspectPackageCompatibility(candidate);
      if (compatibility.needsMigration || compatibility.missingMedia.length) {
        unavailable = true;
        continue;
      }
      valid.push(await fs.realpath(candidate));
      if (
        marker.sourceRevision
          ? marker.sourceRevision !== inventory.revision
          : marker.sourceFingerprint !== inventory.fingerprint
      )
        diverged = true;
    } catch {
      unavailable = true;
    }
  }
  const unique = [...new Set(valid)];
  if (unique.length === 1 && !diverged && !unavailable) return unique[0];
  // Older releases left no mark on the original. Missing index + moved copy
  // cannot be distinguished from a first open: confirm the content once.
  const reason = unavailable
    ? 'unavailable'
    : unique.length || diverged
      ? 'conflict'
      : 'untracked';
  if (!choose) throw new Error(`PACKAGE_UPDATE_CHOICE_REQUIRED:${reason}`);
  const selected = await choose({ source, candidates: unique, reason });
  if (!selected) throw new Error('PACKAGE_MIGRATION_CANCELLED');
  if (samePackagePath(selected, source)) return source;
  const resolved = await fs.realpath(selected);
  const marker = await readMigrationMarker(resolved);
  if (
    !marker ||
    (!samePackagePath(marker.sourceRealPath, source) &&
      marker.sourceRevision !== inventory.revision &&
      marker.sourceFingerprint !== inventory.fingerprint)
  )
    throw new Error('PACKAGE_UPDATE_UNRELATED_COPY');
  const compatibility = await inspectPackageCompatibility(resolved);
  if (compatibility.needsMigration || compatibility.missingMedia.length)
    throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
  return resolved;
};
