import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { migrateLegacyFolder } from './legacyPackageCopyService';
import {
  inspectPackageCompatibility,
  INCOMPLETE_NAMED_PACKAGE,
} from './packageCompatibilityValidation';
import { packageCopyDigest } from './packageCopyDigest';
import { snapshotPackageSource } from './packageSourceSnapshot';
import { reservePackageUpdates } from './packageUpdateLeases';
import { strictPathExists, UPDATE_RECEIPT } from './packageUpdateJournal';
import type { AssertPackageAvailable } from './packageInPlaceUpdate';
import type { PackageOpenReadyResult } from '../../../src/types/package/migration';

export const installNamedLegacyPackage = async (
  source: string,
  assertAvailable: AssertPackageAvailable,
): Promise<PackageOpenReadyResult> => {
  const destination = source + '.stpkg';
  const release = reservePackageUpdates([source, destination]);
  let work: string | undefined;
  let reserved = false;
  try {
    assertAvailable(source);
    assertAvailable(destination);
    if (await strictPathExists(destination))
      throw new Error('PACKAGE_MIGRATION_TARGET_EXISTS');
    // Renaming at the end must not bypass a read-only document's permissions.
    for (const name of ['.metadata/config.json', 'timeline.json']) {
      const handle = await fs.open(path.join(source, name), 'r+');
      await handle.close();
    }
    await fs.access(source, fs.constants.W_OK);
    const original = await snapshotPackageSource(source);
    const sourceDigest = await packageCopyDigest(source, true);
    work = await fs.mkdtemp(
      path.join(path.dirname(source), '.sportag-conversion-'),
    );
    const stage = path.join(work, 'prepared.stpkg');
    const backup = path.join(work, 'original', path.basename(source));
    await fs.mkdir(path.dirname(backup));
    await fs.writeFile(
      path.join(work, 'README.txt'),
      '変換前の原本は original 内です。復元時はアプリを閉じ、現在の .stpkg を別の場所に保管してから、原本を元のフォルダ名で戻してください。\n',
    );
    // The ordinary Open path refuses to edit the archived original in place.
    await fs.writeFile(
      path.join(work, 'transaction.json'),
      JSON.stringify({ schemaVersion: 1, kind: 'named-package-backup' }),
    );
    await migrateLegacyFolder({
      sourceRealPath: source,
      sourceFingerprint: original.fingerprint,
      sourceRevision: original.revision,
      targetPath: stage,
    });
    const id =
      new Date().toISOString().replace(/[:.Z]/g, '') + '-' + randomUUID();
    await fs.writeFile(
      path.join(stage, UPDATE_RECEIPT),
      JSON.stringify({
        schemaVersion: 1,
        id,
        source: destination,
        adoptedFrom: destination,
        adoptedRevision: original.revision,
        backupPath: backup,
      }),
    );
    const marker = path.join(stage, INCOMPLETE_NAMED_PACKAGE);
    await fs.writeFile(marker, id, { flag: 'wx' });
    const expected = await packageCopyDigest(stage, true);
    // Exclusive creation also protects an existing *empty* destination directory.
    await fs.mkdir(destination, { mode: 0o700 });
    reserved = true;
    const pending = path.join(destination, INCOMPLETE_NAMED_PACKAGE);
    await fs.rename(marker, pending);
    const entries = await fs.readdir(stage);
    for (const entry of entries
      .filter((name) => name !== '.metadata')
      .concat('.metadata'))
      await fs.rename(path.join(stage, entry), path.join(destination, entry));
    const checked = await inspectPackageCompatibility(destination, true);
    if (
      checked.needsMigration ||
      checked.missingMedia.length ||
      (await packageCopyDigest(destination, true)) !== expected
    )
      throw new Error('PACKAGE_MIGRATION_COPY_INVALID');
    assertAvailable(source);
    assertAvailable(destination);
    if (
      (await snapshotPackageSource(source)).fingerprint !==
        original.fingerprint ||
      (await packageCopyDigest(source, true)) !== sourceDigest
    )
      throw new Error('PACKAGE_SOURCE_CHANGED');
    await fs.rmdir(stage);
    // The destination is complete before removing the marker. A crash before the
    // final rename leaves the original in place; after it, in the documented backup.
    await fs.unlink(pending);
    await fs.rename(source, backup);
    return {
      status: 'ready',
      packagePath: destination,
      sourcePath: source,
      backupPath: backup,
      migrated: true,
      reused: false,
    };
  } catch (cause) {
    if (reserved) {
      // Preserve the original and any visible destination after an ambiguous error.
      throw new Error(
        `PACKAGE_NAMED_INSTALL_INTERRUPTED: ${destination} (作業場所: ${work})`,
      );
    }
    if (work) await fs.rm(work, { recursive: true, force: true });
    throw cause;
  } finally {
    release();
  }
};
