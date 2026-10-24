import { readPackageHistoryDirectory } from './packageHistoryDirectory';
import path from 'node:path';
import { packageCopyDigest } from './packageCopyDigest';
import {
  packageUpdatePaths,
  readPackageBackupJournal,
  readUpdateReceipt,
  samePackagePath,
} from './packageUpdateJournal';

/** A restored original must not silently re-adopt the copy it was restored over. */
export const isPackageRestoredFromBackup = async (
  source: string,
  options: {
    signal?: AbortSignal;
    directoryWaiting?: (waiting: boolean) => void;
  } = {},
): Promise<boolean> => {
  const receipt = await readUpdateReceipt(source);
  // Moving a completed document (including its enclosing folder and backups)
  // starts an independent location; its archived paths describe the old one.
  if (receipt && !samePackagePath(receipt.source, source)) return false;
  const parent = path.dirname(source);
  const prefix = `${path.basename(source)}.backup-`;
  options.directoryWaiting?.(true);
  let entries: string[];
  try {
    // Names only: do not request metadata for unrelated siblings.
    entries = await readPackageHistoryDirectory(parent, options.signal);
  } finally {
    options.directoryWaiting?.(false);
  }
  if (entries.length > 10_000) throw new Error('PACKAGE_TOO_MANY_FILES');
  let digest: string | undefined;
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    const id = entry.slice(prefix.length);
    if (!/^[0-9T-]+-[a-f0-9-]{36}$/.test(id)) continue;
    // The installed receipt cannot be the pre-update contents of its own update.
    if (receipt?.id === id && samePackagePath(receipt.source, source)) continue;
    const directory = path.join(parent, entry);
    const journal = await readPackageBackupJournal(directory).catch(() => {
      throw new Error('PACKAGE_UPDATE_BACKUP_HISTORY_INVALID');
    });
    if (
      journal.id !== id ||
      !samePackagePath(directory, packageUpdatePaths(source, id).backup)
    )
      throw new Error('PACKAGE_UPDATE_BACKUP_HISTORY_INVALID');
    // A whole parent-folder move can bring a valid archive from an old path.
    // It is not evidence for automatic adoption at this new location.
    if (!samePackagePath(journal.source, source)) continue;
    // New journals identify the previous receipt, avoiding media hashing on
    // ordinary repeat opens. Older journals fall back to the full byte digest.
    if (
      journal.sourceReceiptId !== undefined &&
      journal.sourceReceiptId !== (receipt?.id ?? null)
    )
      continue;
    digest ??= await packageCopyDigest(source, true);
    if (digest === journal.sourceDigest) return true;
  }
  return false;
};
