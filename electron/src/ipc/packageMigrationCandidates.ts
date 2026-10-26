import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectPackageCompatibility } from './packageCompatibilityValidation';
import { readMigrationMarker } from './packageMigrationTargets';
import type { PackageMigrationIndex } from './packageMigrationIndex';
import { snapshotPackageSource } from './packageSourceSnapshot';
import { readPackageHistoryEntries } from './packageHistoryDirectory';
import { checkPackageHistoryCancellation } from './packageHistoryRead';
import type { PackageHistoryReadOptions } from './packageHistoryRead';
import {
  readUpdateReceipt,
  samePackagePath,
  strictPathExists,
} from './packageUpdateJournal';

export interface PackageContentChoice {
  source: string;
  candidates: string[];
  reason: 'untracked' | 'conflict' | 'unavailable' | 'restored';
}
export type ChoosePackageContent = (
  choice: PackageContentChoice,
) => Promise<string | null>;

export const collectPreviousPackageCopies = async (
  source: string,
  index?: PackageMigrationIndex,
  historyRead: PackageHistoryReadOptions = {},
): Promise<Set<string>> => {
  checkPackageHistoryCancellation(historyRead.signal);
  const registered = (await index?.listForSource(source)) ?? [];
  const candidates = new Set(registered.map((entry) => entry.target));
  checkPackageHistoryCancellation(historyRead.signal);
  historyRead.directoryWaiting?.(true);
  let entries: Awaited<ReturnType<typeof readPackageHistoryEntries>>;
  try {
    entries = await readPackageHistoryEntries(
      path.dirname(source),
      historyRead.signal,
    );
  } finally {
    historyRead.directoryWaiting?.(false);
  }
  checkPackageHistoryCancellation(historyRead.signal);
  if (entries.length > 10_000) throw new Error('PACKAGE_TOO_MANY_FILES');
  for (const entry of entries) {
    checkPackageHistoryCancellation(historyRead.signal);
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = path.join(path.dirname(source), entry.name);
    if (samePackagePath(candidate, source)) continue;
    const marker = await readMigrationMarker(candidate);
    if (marker && samePackagePath(marker.sourceRealPath, source))
      candidates.add(candidate);
  }
  // A completed current document is an independent saved version, not a
  // historical migration copy that Open may adopt without a content choice.
  for (const candidate of candidates) {
    checkPackageHistoryCancellation(historyRead.signal);
    if (
      (await strictPathExists(candidate)) &&
      (await readUpdateReceipt(candidate))
    )
      candidates.delete(candidate);
  }
  checkPackageHistoryCancellation(historyRead.signal);
  return candidates;
};

export const choosePackageMigrationContent = async (
  source: string,
  index?: PackageMigrationIndex,
  choose?: ChoosePackageContent,
  forcedReason?: 'restored',
  historyRead: PackageHistoryReadOptions = {},
): Promise<string> => {
  checkPackageHistoryCancellation(historyRead.signal);
  const inventory = await snapshotPackageSource(source);
  const candidates = await collectPreviousPackageCopies(
    source,
    index,
    historyRead,
  );
  const valid: string[] = [];
  let unavailable = false;
  let diverged = false;
  for (const candidate of candidates) {
    checkPackageHistoryCancellation(historyRead.signal);
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
      checkPackageHistoryCancellation(historyRead.signal);
      unavailable = true;
    }
  }
  const unique = [...new Set(valid)];
  checkPackageHistoryCancellation(historyRead.signal);
  if (!forcedReason && unique.length === 1 && !diverged && !unavailable)
    return unique[0];
  // Older releases left no mark on the original. Missing index + moved copy
  // cannot be distinguished from a first open: confirm the content once.
  const reason =
    forcedReason ??
    (unavailable
      ? 'unavailable'
      : unique.length || diverged
        ? 'conflict'
        : 'untracked');
  if (!choose) throw new Error(`PACKAGE_UPDATE_CHOICE_REQUIRED:${reason}`);
  const selected = await choose({ source, candidates: unique, reason });
  checkPackageHistoryCancellation(historyRead.signal);
  if (!selected) throw new Error('PACKAGE_MIGRATION_CANCELLED');
  if (samePackagePath(selected, source)) return source;
  const resolved = await fs.realpath(selected);
  const marker = await readMigrationMarker(resolved);
  const receipt = await readUpdateReceipt(resolved);
  if (
    !(receipt && samePackagePath(receipt.source, source)) &&
    (!marker ||
      (!samePackagePath(marker.sourceRealPath, source) &&
        marker.sourceRevision !== inventory.revision &&
        marker.sourceFingerprint !== inventory.fingerprint))
  )
    throw new Error('PACKAGE_UPDATE_UNRELATED_COPY');
  const compatibility = await inspectPackageCompatibility(resolved);
  checkPackageHistoryCancellation(historyRead.signal);
  if (compatibility.needsMigration || compatibility.missingMedia.length)
    throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
  return resolved;
};
