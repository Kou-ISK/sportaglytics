import { reservePackageUpdates } from './packageUpdateLeases';
import { readProcessStartIdentity } from './packageUpdateOwner';
import {
  isAbsoluteMediaReference,
  resolvePackageMediaPath,
} from '../../../src/shared/media/packageMediaPath';
import { isPathInside } from './packageMigrationTargets';
import { readPackageJson } from './packageCompatibilityValidation';
import { isPlainObject } from './ipcPayloadGuards';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { migrateLegacyFolder } from './legacyPackageCopyService';
import { inspectPackageCompatibility } from './packageCompatibilityValidation';
import { packageCopyDigest } from './packageCopyDigest';
import {
  checkMigrationCapacity,
  snapshotPackageSource,
} from './packageSourceSnapshot';
import {
  UPDATE_RECEIPT,
  assertJournalOwnerInactive,
  packageUpdatePaths,
  readUpdateJournal,
  readUpdateReceipt,
  saveUpdateJournal,
  strictPathExists,
} from './packageUpdateJournal';
import type { PackageUpdateJournal } from './packageUpdateJournal';

export interface PackageUpdateResult {
  backupPath: string;
  recovered: boolean;
}
export type AssertPackageAvailable = (packagePath: string) => void;
const noop: AssertPackageAvailable = () => undefined;

const assertUnchanged = async (
  file: string,
  fingerprint: string,
): Promise<void> => {
  if ((await snapshotPackageSource(file)).fingerprint !== fingerprint)
    throw new Error('PACKAGE_SOURCE_CHANGED');
};

const assertPrepared = async (
  file: string,
  journal: PackageUpdateJournal,
): Promise<void> => {
  const compatibility = await inspectPackageCompatibility(file, true);
  if (
    compatibility.needsMigration ||
    compatibility.missingMedia.length ||
    !journal.stageDigest ||
    (await packageCopyDigest(file, true)) !== journal.stageDigest ||
    (await readUpdateReceipt(file))?.id !== journal.id
  )
    throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
};

const finishInstalled = async (
  journal: PackageUpdateJournal,
): Promise<void> => {
  const paths = packageUpdatePaths(journal.source, journal.id);
  await assertPrepared(journal.source, journal);
  if ((await packageCopyDigest(paths.original, true)) !== journal.sourceDigest)
    throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
  if (await strictPathExists(paths.backup))
    throw new Error('PACKAGE_UPDATE_BACKUP_CONFLICT');
  journal.phase = 'installed';
  journal.pid = 0;
  await saveUpdateJournal(journal);
  // Only the transaction-owned directory is moved; an existing backup is never reused.
  await fs.rename(paths.work, paths.backup);
};

/** Restore before binding a missing original path. Two renames are NOT an atomic exchange. */
export const recoverPackageUpdate = async (
  source: string,
  assertAvailable: AssertPackageAvailable = noop,
): Promise<PackageUpdateResult | undefined> => {
  const paths = packageUpdatePaths(source);
  if (!(await strictPathExists(paths.work))) return undefined;
  let journal: PackageUpdateJournal;
  try {
    journal = await readUpdateJournal(source);
  } catch {
    // No destructive operation is possible before the first journal is durable.
    // Quarantine only the narrowly recognized initialization footprint; preserve
    // any partial record instead of deleting or guessing about unknown contents.
    if (
      (await strictPathExists(source)) &&
      !(await strictPathExists(paths.journal))
    ) {
      const workStat = await fs.lstat(paths.work);
      const names =
        workStat.isDirectory() && !workStat.isSymbolicLink()
          ? await fs.readdir(paths.work)
          : [];
      let bootstrap = workStat.isDirectory() && !workStat.isSymbolicLink();
      for (const name of names) {
        const file = path.join(paths.work, name);
        const stat = await fs.lstat(file);
        if (name === 'original')
          bootstrap &&=
            stat.isDirectory() &&
            !stat.isSymbolicLink() &&
            (await fs.readdir(file)).length === 0;
        else
          bootstrap &&=
            /^\.transaction\.json\.[a-f0-9-]+\.writing$/.test(name) &&
            stat.isFile() &&
            !stat.isSymbolicLink();
      }
      if (bootstrap) {
        const retained = `${source}.recovery-${randomUUID()}`;
        await fs.rename(paths.work, retained);
        await fs.writeFile(
          path.join(retained, 'README.txt'),
          'Initialization was interrupted before the original was moved. The original is unchanged. This folder contains only the retained initialization record.\n',
          { flag: 'wx' },
        );
        return undefined;
      }
    }
    throw new Error(`PACKAGE_UPDATE_RECOVERY_REQUIRED:${paths.work}`);
  }
  await assertJournalOwnerInactive(journal);
  assertAvailable(source);
  assertAvailable(journal.adoptedFrom);
  const release = reservePackageUpdates([source, journal.adoptedFrom]);
  try {
    const originalParent = await fs.lstat(path.dirname(paths.original));
    if (!originalParent.isDirectory() || originalParent.isSymbolicLink())
      throw new Error(`PACKAGE_UPDATE_RECOVERY_REQUIRED:${paths.work}`);
    const hasSource = await strictPathExists(source);
    const hasBackup = await strictPathExists(paths.original);
    const hasStage = await strictPathExists(paths.stage);
    if (hasSource && hasBackup) {
      // A process may have died immediately after publishing, before updating its journal.
      if (hasStage)
        throw new Error(`PACKAGE_UPDATE_RECOVERY_REQUIRED:${paths.work}`);
      await finishInstalled(journal);
      return { backupPath: journal.backupPath, recovered: true };
    }
    if (!hasSource && hasBackup) {
      if (
        (await packageCopyDigest(paths.original, true)) !== journal.sourceDigest
      )
        throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
      // Roll back to the complete original. The next open can prepare afresh.
      await fs.rename(paths.original, source);
      await fs.rm(paths.work, { recursive: true });
      return undefined;
    }
    if (hasSource && !hasBackup && journal.phase !== 'installed') {
      await assertUnchanged(source, journal.sourceFingerprint);
      await fs.rm(paths.work, { recursive: true });
      return undefined;
    }
    throw new Error(`PACKAGE_UPDATE_RECOVERY_REQUIRED:${paths.work}`);
  } finally {
    release();
  }
};

/** Build and validate beside the original, then publish with a recoverable backup. */
const performPackageUpdate = async (
  source: string,
  adoptedFrom: string,
  assertAvailable: AssertPackageAvailable = noop,
): Promise<PackageUpdateResult> => {
  assertAvailable(source);
  assertAvailable(adoptedFrom);
  const sourceSnapshot = await snapshotPackageSource(source);
  const adopted =
    adoptedFrom === source
      ? sourceSnapshot
      : await snapshotPackageSource(adoptedFrom);
  await checkMigrationCapacity(path.dirname(source), adopted.bytes);
  // Respect read-only originals even where the parent directory would allow a rename.
  await fs.access(source, fs.constants.W_OK);
  await fs.access(
    path.join(source, '.metadata/config.json'),
    fs.constants.W_OK,
  );
  await fs.access(path.join(source, 'timeline.json'), fs.constants.W_OK);
  for (const file of ['.metadata/config.json', 'timeline.json']) {
    // access(W_OK) does not test Windows ACLs. Open without truncation or writes.
    const handle = await fs.open(path.join(source, file), 'r+');
    await handle.close();
  }
  const id = `${new Date().toISOString().replace(/[:.Z]/g, '')}-${randomUUID()}`;
  const paths = packageUpdatePaths(source, id);
  const journal: PackageUpdateJournal = {
    schemaVersion: 1,
    id,
    source,
    adoptedFrom,
    adoptedRevision: adopted.revision,
    backupPath: path.join(paths.backup, 'original', path.basename(source)),
    sourceFingerprint: sourceSnapshot.fingerprint,
    adoptedFingerprint: adopted.fingerprint,
    phase: 'preparing',
    pid: process.pid,
    ownerIdentity: await readProcessStartIdentity(process.pid),
    sourceDigest: await packageCopyDigest(source, true),
  };
  await fs.mkdir(paths.work, { mode: 0o700 });
  let originalMoved = false;
  try {
    await fs.mkdir(path.dirname(paths.original));
    await saveUpdateJournal(journal);
    await fs.writeFile(
      path.join(paths.work, 'README.txt'),
      'SporTagLytics backup / 更新前の原本\n\n' +
        'original 内に更新前のファイルをそのまま保存しています。バックアップは自動削除しません。\n' +
        '復元するにはアプリで対象を閉じ、現在のファイルを別の場所に保管してから original 内のファイルを元の場所に戻してください。\n' +
        '更新途中で止まった場合は、このフォルダ内を変更せず、元の場所をアプリから再度開いてください。\n',
      'utf8',
    );
    await migrateLegacyFolder({
      sourceRealPath: adoptedFrom,
      sourceFingerprint: adopted.fingerprint,
      sourceRevision: adopted.revision,
      targetPath: paths.stage,
    });
    if (adoptedFrom !== source) {
      const config = await readPackageJson(
        path.join(paths.stage, '.metadata/config.json'),
      );
      const references: string[] = [];
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (isPlainObject(value))
          for (const [key, child] of Object.entries(value)) {
            if (
              ['relativePath', 'tightViewPath', 'wideViewPath'].includes(key) &&
              typeof child === 'string'
            )
              references.push(child);
            else collect(child);
          }
      };
      collect(config);
      for (const reference of references) {
        if (!isAbsoluteMediaReference(reference)) continue;
        const realReference = await fs.realpath(
          resolvePackageMediaPath(adoptedFrom, reference),
        );
        if (isPathInside(source, realReference))
          throw new Error('PACKAGE_UPDATE_REFERENCE_CONFLICT');
      }
    }
    await fs.writeFile(
      path.join(paths.stage, UPDATE_RECEIPT),
      JSON.stringify(
        {
          schemaVersion: 1,
          id,
          source,
          adoptedFrom,
          adoptedRevision: adopted.revision,
          backupPath: journal.backupPath,
        },
        null,
        2,
      ),
    );
    journal.stageDigest = await packageCopyDigest(paths.stage, true);
    journal.phase = 'prepared';
    await saveUpdateJournal(journal);
    await assertPrepared(paths.stage, journal);
    await assertUnchanged(source, sourceSnapshot.fingerprint);
    await assertUnchanged(adoptedFrom, adopted.fingerprint);
    assertAvailable(source);
    assertAvailable(adoptedFrom);
    if (
      (await strictPathExists(paths.original)) ||
      (await strictPathExists(paths.backup))
    )
      throw new Error('PACKAGE_UPDATE_BACKUP_CONFLICT');
    originalMoved = true;
    await fs.rename(source, paths.original);
    if (await strictPathExists(source))
      throw new Error('PACKAGE_UPDATE_PATH_CONFLICT');
    await fs.rename(paths.stage, source);
    await finishInstalled(journal);
    return { backupPath: journal.backupPath, recovered: false };
  } catch (error) {
    if (
      originalMoved &&
      (await strictPathExists(source)) &&
      !(await strictPathExists(paths.original))
    ) {
      // The first rename may have failed before moving anything.
      await assertUnchanged(source, sourceSnapshot.fingerprint);
      originalMoved = false;
    }
    if (!originalMoved) {
      await fs
        .rm(paths.work, { recursive: true, force: true })
        .catch(() => undefined);
      throw error;
    }
    // Never remove the only original or the published package after a failed commit.
    try {
      if (!(await strictPathExists(source))) {
        await assertUnchanged(paths.original, sourceSnapshot.fingerprint);
        await fs.rename(paths.original, source);
        await fs.rm(paths.work, { recursive: true });
        throw error;
      }
    } catch (rollbackError) {
      if (rollbackError === error) throw error;
    }
    journal.pid = 0;
    await saveUpdateJournal(journal).catch(() => undefined);
    throw new Error(`PACKAGE_UPDATE_RECOVERY_REQUIRED:${paths.work}`);
  }
};

export const updatePackageInPlace = async (
  source: string,
  adoptedFrom: string,
  assertAvailable: AssertPackageAvailable = noop,
): Promise<PackageUpdateResult> => {
  const release = reservePackageUpdates([source, adoptedFrom]);
  try {
    return await performPackageUpdate(source, adoptedFrom, assertAvailable);
  } finally {
    release();
  }
};
