import fs from 'node:fs/promises';
import path from 'node:path';
import type { PackageOpenReadyResult } from '../../../src/types/package/migration';
import type { PackageMigrationIndex } from './packageMigrationIndex';
import {
  inspectPackageCompatibility,
  readPackageJson,
} from './packageCompatibilityValidation';
import {
  choosePackageMigrationContent,
  collectPreviousPackageCopies,
} from './packageMigrationCandidates';
import type { ChoosePackageContent } from './packageMigrationCandidates';
import {
  recoverPackageUpdate,
  updatePackageInPlace,
} from './packageInPlaceUpdate';
import type { AssertPackageAvailable } from './packageInPlaceUpdate';
import { readMigrationMarker } from './packageMigrationTargets';
import {
  readUpdateReceipt,
  packageUpdatePaths,
  samePackagePath,
  strictPathExists,
} from './packageUpdateJournal';
import { snapshotPackageSource } from './packageSourceSnapshot';
import { isPackageUpdating } from './packageUpdateLeases';
import { isPackageRestoredFromBackup } from './packageBackupRestoration';

export interface PackageOpenOptions {
  index?: PackageMigrationIndex;
  choose?: ChoosePackageContent;
  assertAvailable?: AssertPackageAvailable;
  historyRead?: {
    signal?: AbortSignal;
    directoryWaiting?: (waiting: boolean) => void;
  };
}
const pending = new Map<string, Promise<PackageOpenReadyResult>>();

const prepare = async (
  source: string,
  options: PackageOpenOptions,
): Promise<PackageOpenReadyResult> => {
  options.historyRead?.signal?.throwIfAborted();
  if (isPackageUpdating(source)) throw new Error('PACKAGE_UPDATE_BUSY');
  const backupRecord = path.join(
    path.dirname(path.dirname(source)),
    'transaction.json',
  );
  if (
    path.basename(path.dirname(source)) === 'original' &&
    (await strictPathExists(backupRecord))
  ) {
    const record = await readPackageJson(backupRecord);
    if (
      record &&
      typeof record === 'object' &&
      'schemaVersion' in record &&
      record.schemaVersion === 1
    )
      throw new Error('PACKAGE_UPDATE_BACKUP_SELECTED');
  }
  const recovered = await recoverPackageUpdate(source, options.assertAvailable);
  const compatibility = await inspectPackageCompatibility(source);
  options.historyRead?.signal?.throwIfAborted();
  if (compatibility.missingMedia.length)
    throw new Error('PACKAGE_MEDIA_MISSING');
  const restored = await isPackageRestoredFromBackup(
    source,
    options.historyRead,
  );
  options.historyRead?.signal?.throwIfAborted();
  if (!compatibility.needsMigration && !restored) {
    const receipt = await readUpdateReceipt(source);
    if (
      receipt &&
      samePackagePath(receipt.source, source) &&
      !samePackagePath(receipt.adoptedFrom, source) &&
      (await strictPathExists(receipt.adoptedFrom)) &&
      (await snapshotPackageSource(receipt.adoptedFrom)).revision !==
        receipt.adoptedRevision
    ) {
      if (!options.choose) throw new Error('PACKAGE_UPDATE_COPY_DIVERGED');
      const sourceBeforeChoice = await snapshotPackageSource(source);
      const copyBeforeChoice = await snapshotPackageSource(receipt.adoptedFrom);
      const selected = await options.choose({
        source,
        candidates: [receipt.adoptedFrom],
        reason: 'conflict',
      });
      if (!selected) throw new Error('PACKAGE_MIGRATION_CANCELLED');
      if (
        (await snapshotPackageSource(source)).fingerprint !==
          sourceBeforeChoice.fingerprint ||
        (await snapshotPackageSource(receipt.adoptedFrom)).fingerprint !==
          copyBeforeChoice.fingerprint
      )
        throw new Error('PACKAGE_SOURCE_CHANGED');
      if (!samePackagePath(selected, source)) {
        if (!samePackagePath(selected, receipt.adoptedFrom))
          throw new Error('PACKAGE_UPDATE_UNRELATED_COPY');
        const result = await updatePackageInPlace(
          source,
          receipt.adoptedFrom,
          options.assertAvailable,
        );
        return {
          status: 'ready',
          packagePath: source,
          migrated: true,
          reused: true,
          backupPath: result.backupPath,
        };
      }
    }
    if (!receipt) {
      const marker = await readMigrationMarker(source);
      if (marker && !samePackagePath(marker.sourceRealPath, source))
        await recoverPackageUpdate(
          marker.sourceRealPath,
          options.assertAvailable,
        );
      if (
        marker &&
        !samePackagePath(marker.sourceRealPath, source) &&
        (await strictPathExists(marker.sourceRealPath))
      ) {
        const promoted = await readUpdateReceipt(marker.sourceRealPath);
        if (promoted && samePackagePath(promoted.adoptedFrom, source)) {
          if (
            (await snapshotPackageSource(source)).revision !==
            promoted.adoptedRevision
          )
            throw new Error('PACKAGE_UPDATE_COPY_DIVERGED');
          const current = await inspectPackageCompatibility(
            marker.sourceRealPath,
          );
          if (current.needsMigration || current.missingMedia.length)
            throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
          return {
            status: 'ready',
            packagePath: marker.sourceRealPath,
            migrated: false,
            reused: true,
          };
        }
      }
    }
    if (
      receipt ||
      (path.extname(source).toLowerCase() === '.stpkg' &&
        (await collectPreviousPackageCopies(source, options.index)).size === 0)
    )
      return {
        status: 'ready',
        packagePath: source,
        migrated: Boolean(recovered),
        reused: false,
        ...(recovered
          ? {
              backupPath: recovered.backupPath,
              warning: 'Previous update recovered.',
            }
          : {}),
      };
  }
  options.assertAvailable?.(source);
  const beforeChoice = await snapshotPackageSource(source);
  const adopted = await choosePackageMigrationContent(
    source,
    options.index,
    options.choose,
    restored ? 'restored' : undefined,
  );
  if (
    (await snapshotPackageSource(source)).fingerprint !==
    beforeChoice.fingerprint
  )
    throw new Error('PACKAGE_SOURCE_CHANGED');
  const result = await updatePackageInPlace(
    source,
    adopted,
    options.assertAvailable,
  );
  return {
    status: 'ready',
    packagePath: source,
    migrated: true,
    reused: adopted !== source,
    sourcePath: source,
    backupPath: result.backupPath,
  };
};

export const preparePackageForOpen = async (
  sourcePath: string,
  options: PackageOpenOptions = {},
): Promise<PackageOpenReadyResult> => {
  // Recover before realpath(source): the path may be absent between commit renames.
  let resolved = path.resolve(sourcePath);
  const parent = await fs.realpath(path.dirname(resolved));
  const requested = path.join(parent, path.basename(resolved));
  // Only supplement old history entries after ruling out interrupted updates.
  if (
    !(await strictPathExists(requested)) &&
    !(await strictPathExists(packageUpdatePaths(requested).work)) &&
    !requested.toLowerCase().endsWith('.stpkg') &&
    (await strictPathExists(`${requested}.stpkg`))
  )
    resolved = `${requested}.stpkg`;
  if (
    (await strictPathExists(resolved)) &&
    (await fs.lstat(resolved)).isSymbolicLink()
  )
    throw new Error('PACKAGE_SOURCE_NOT_DIRECTORY');
  const source = (await strictPathExists(resolved))
    ? await fs.realpath(resolved)
    : path.join(
        await fs.realpath(path.dirname(resolved)),
        path.basename(resolved),
      );
  const key = (
    process.platform === 'win32' ? source.toLowerCase() : source
  ).normalize('NFC');
  const prior = pending.get(key);
  const task = (prior ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => prepare(source, options));
  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
};
