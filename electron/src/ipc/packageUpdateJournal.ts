import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readPackageJson } from './packageCompatibilityValidation';
import { isPlainObject } from './ipcPayloadGuards';
import { writeTextFileAtomically } from './atomicTextFile';
import { readProcessStartIdentity } from './packageUpdateOwner';
import { isPackageUpdating } from './packageUpdateLeases';

export const UPDATE_RECEIPT = '.metadata/in-place-update.json';
export interface PackageUpdateReceipt {
  schemaVersion: 1;
  id: string;
  source: string;
  adoptedFrom: string;
  adoptedRevision: string;
  backupPath: string;
}
export interface PackageUpdateJournal extends PackageUpdateReceipt {
  pid: number;
  ownerIdentity: string;
  sourceDigest: string;
  sourceFingerprint: string;
  adoptedFingerprint: string;
  stageDigest?: string;
  phase: 'preparing' | 'prepared' | 'installed';
}

export const samePackagePath = (a: string, b: string): boolean => {
  const normalize = (value: string): string => {
    const normalized = path.resolve(value).normalize('NFC');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  return normalize(a) === normalize(b);
};

export const packageUpdatePaths = (
  source: string,
  id = '',
): {
  work: string;
  stage: string;
  original: string;
  journal: string;
  backup: string;
} => {
  const identity = process.platform === 'win32' ? source.toLowerCase() : source;
  const hash = createHash('sha256')
    .update(identity.normalize('NFC'))
    .digest('hex')
    .slice(0, 24);
  const work = path.join(path.dirname(source), `.sportag-update-${hash}`);
  return {
    work,
    stage: path.join(work, '.sportag-migrating-prepared'),
    original: path.join(work, 'original', path.basename(source)),
    journal: path.join(work, 'transaction.json'),
    backup: `${source}.backup-${id}`,
  };
};

export const strictPathExists = async (file: string): Promise<boolean> => {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return false;
    throw error;
  }
};

export const readUpdateReceipt = async (
  source: string,
): Promise<PackageUpdateReceipt | null> => {
  const file = path.join(source, UPDATE_RECEIPT);
  if (!(await strictPathExists(file))) return null;
  const value = await readPackageJson(file);
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 1 ||
    typeof value.id !== 'string' ||
    !/^[0-9T-]+-[a-f0-9-]{36}$/.test(value.id) ||
    !['source', 'adoptedFrom', 'adoptedRevision', 'backupPath'].every(
      (key) => typeof value[key] === 'string',
    )
  )
    throw new Error('PACKAGE_UPDATE_RECEIPT_INVALID');
  return value as unknown as PackageUpdateReceipt;
};

export const readUpdateJournal = async (
  source: string,
): Promise<PackageUpdateJournal> => {
  const locations = packageUpdatePaths(source);
  const stat = await fs.lstat(locations.work);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
  const value = await readPackageJson(locations.journal);
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 1 ||
    typeof value.id !== 'string' ||
    !/^[0-9T-]+-[a-f0-9-]{36}$/.test(value.id) ||
    typeof value.source !== 'string' ||
    !samePackagePath(value.source, source) ||
    typeof value.pid !== 'number' ||
    !Number.isSafeInteger(value.pid) ||
    value.pid < 0 ||
    ![
      'ownerIdentity',
      'sourceDigest',
      'sourceFingerprint',
      'adoptedFrom',
      'adoptedRevision',
      'adoptedFingerprint',
      'backupPath',
    ].every((key) => typeof value[key] === 'string') ||
    !['preparing', 'prepared', 'installed'].includes(String(value.phase)) ||
    (value.stageDigest !== undefined &&
      (typeof value.stageDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.stageDigest))) ||
    value.backupPath !==
      path.join(
        packageUpdatePaths(value.source, value.id).backup,
        'original',
        path.basename(value.source),
      )
  )
    throw new Error('PACKAGE_UPDATE_RECOVERY_REQUIRED');
  return value as unknown as PackageUpdateJournal;
};

export const saveUpdateJournal = async (
  journal: PackageUpdateJournal,
): Promise<void> => {
  await writeTextFileAtomically(
    packageUpdatePaths(journal.source).journal,
    JSON.stringify(journal, null, 2),
  );
};

export const assertJournalOwnerInactive = async (
  journal: PackageUpdateJournal,
): Promise<void> => {
  if (!journal.pid) return;
  if (journal.pid === process.pid && !isPackageUpdating(journal.source)) return;
  try {
    process.kill(journal.pid, 0);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return;
    throw new Error('PACKAGE_UPDATE_BUSY');
  }
  if ((await readProcessStartIdentity(journal.pid)) !== journal.ownerIdentity)
    return;
  throw new Error('PACKAGE_UPDATE_BUSY');
};
