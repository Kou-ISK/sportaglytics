import { app } from 'electron';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolveNativeResources } from '../nativePlayback/runtime/nativeResources';
import type { RetainedExportDirectory } from '../../../src/types/ipc/exportProgressWindow';

/** The helper may have committed but not returned a receipt. Never retry or delete. */
export class IndeterminatePublicationError extends Error {
  readonly retainedDirectories: RetainedExportDirectory[] = [];
  constructor() {
    super('Export publication outcome is uncertain');
    this.name = 'IndeterminatePublicationError';
  }
  retain(record: RetainedExportDirectory): void {
    this.retainedDirectories.push(record);
  }
}

export const describeExportStaging = async (
  directory: string,
  purpose: RetainedExportDirectory['purpose'],
  reason: RetainedExportDirectory['reason'] = 'publication-uncertain',
): Promise<RetainedExportDirectory> => {
  const stat = await fs.lstat(directory, { bigint: true });
  if (!stat.isDirectory()) throw new Error('Export staging directory changed');
  return {
    id: randomUUID(),
    path: directory,
    purpose,
    device: String(stat.dev),
    inode: String(stat.ino),
    reason,
    writerStatus: 'unknown',
  };
};

type ExclusiveFallback = (source: string, target: string) => Promise<void>;
const execute = promisify(execFile);

const publishWithSignedHost: ExclusiveFallback = async (source, target) => {
  if (
    process.platform !== 'darwin' ||
    process.arch !== 'arm64' ||
    !app.isPackaged
  ) {
    throw Object.assign(
      new Error('Export destination does not support safe publication'),
      { code: 'ENOTSUP' },
    );
  }
  const parent = await fs.realpath(path.dirname(target));
  const sourceParent = await fs.realpath(path.dirname(path.dirname(source)));
  if (parent !== sourceParent) throw new Error('Invalid export staging parent');
  const stage = path.basename(path.dirname(source));
  const src = path.basename(source);
  const dst = path.basename(target);
  const [file, parentInfo, stageInfo] = await Promise.all([
    fs.lstat(source, { bigint: true }),
    fs.lstat(parent, { bigint: true }),
    fs.lstat(path.dirname(source), { bigint: true }),
  ]);
  if (
    !file.isFile() ||
    file.size <= 0n ||
    !parentInfo.isDirectory() ||
    !stageInfo.isDirectory()
  )
    throw new Error('Invalid export staging identity');
  const { host } = await resolveNativeResources(
    process.resourcesPath,
    path.join(app.getPath('userData'), 'native-export'),
  );
  try {
    const result = await execute(
      host,
      [
        '--publish-exclusive',
        parent,
        stage,
        src,
        dst,
        String(file.dev),
        String(file.ino),
        String(file.size),
        String(parentInfo.dev),
        String(parentInfo.ino),
        String(stageInfo.dev),
        String(stageInfo.ino),
        'v1',
      ],
      { timeout: 30000, maxBuffer: 4096, windowsHide: true },
    );
    if (result.stdout !== 'PUB1:OK\n')
      throw new IndeterminatePublicationError();
  } catch (error) {
    if (error instanceof IndeterminatePublicationError) throw error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 73
    )
      throw Object.assign(new Error('Export destination already exists'), {
        code: 'EEXIST',
      });
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 78
    )
      throw Object.assign(
        new Error('Export destination does not support safe publication'),
        { code: 'ENOTSUP' },
      );
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 64 || error.code === 74)
    )
      throw new Error('Export staging validation failed');
    throw new IndeterminatePublicationError();
  }
};

export const publishExclusive = async (
  source: string,
  target: string,
  fallback: ExclusiveFallback = publishWithSignedHost,
): Promise<void> => {
  try {
    await fs.link(source, target);
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      !['ENOTSUP', 'EOPNOTSUPP', 'EPERM'].includes(String(error.code))
    )
      throw error;
    await fallback(source, target);
  }
};
