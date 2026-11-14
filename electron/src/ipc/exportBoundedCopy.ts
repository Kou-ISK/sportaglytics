import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { transferRetained } from './exportRetainedRecords';

/** A partial destination is deliberately retained on failure. It is not a
 * final output and this error grants no authority to delete it. */
export class ExportCopyIncomplete extends Error {
  readonly originalError: unknown;
  readonly retainedPath: string | undefined;
  readonly closeErrors: unknown[];
  constructor(error: unknown, retainedPath?: string, closeErrors: unknown[] = []) {
    super('コピーを完了できませんでした');
    this.name = error instanceof Error && error.name === 'AbortError' ? 'AbortError' : 'ExportCopyIncomplete';
    this.originalError = error;
    this.retainedPath = retainedPath;
    this.closeErrors = closeErrors;
    transferRetained(error, this);
  }
}
export interface CopyBudget {
  maxBytes: number;
  minimumFreeBytes: number;
  signal?: AbortSignal;
  onChunk?: (bytes: number) => void;
}
/** Chunked bounded copy; statfs is a snapshot and cannot reserve disk space. */
export const copyWithBudget = async (source: string, destination: string, budget: CopyBudget): Promise<void> => {
  if (!Number.isSafeInteger(budget.maxBytes) || budget.maxBytes <= 0 || !Number.isSafeInteger(budget.minimumFreeBytes) || budget.minimumFreeBytes < 0) throw new Error('Invalid copy budget');
  if (!constants.O_NOFOLLOW) throw new Error('Safe copy unsupported');
  let input: fs.FileHandle | undefined;
  let output: fs.FileHandle | undefined;
  let failure: unknown;
  let failed = false;
  try {
    budget.signal?.throwIfAborted();
    input = await fs.open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await input.stat();
    if (!info.isFile() || info.size > budget.maxBytes) throw new Error('Copy source exceeds budget');
    output = await fs.open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let total = 0;
    for (;;) {
      budget.signal?.throwIfAborted();
      const space = await fs.statfs(path.dirname(destination));
      if (!Number.isFinite(space.bavail * space.bsize) || space.bavail * space.bsize < budget.minimumFreeBytes) throw new Error('Copy free space insufficient');
      const read = await input.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      total += read.bytesRead;
      if (total > budget.maxBytes) throw new Error('Copy exceeds budget');
      let written = 0;
      while (written < read.bytesRead) {
        budget.signal?.throwIfAborted();
        const result = await output.write(buffer, written, read.bytesRead - written, null);
        if (!result.bytesWritten) throw new Error('Copy made no progress');
        written += result.bytesWritten;
      }
      budget.onChunk?.(total);
    }
    budget.signal?.throwIfAborted();
    const after = await input.stat();
    if (total !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) throw new Error('Copy source changed');
    await output.sync();
  } catch (error) { failed = true; failure = error; }
  const closed = await Promise.allSettled([input?.close(), output?.close()]);
  const closeErrors = closed.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
  if (!failed && closeErrors.length) {
    failed = true; failure = new Error('Copy close failed');
  }
  if (failed) throw new ExportCopyIncomplete(failure, output ? destination : undefined, closeErrors);
};
