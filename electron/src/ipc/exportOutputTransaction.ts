import { normalizeExportError, rememberRetained, retainedFor } from './exportRetainedRecords';
import { ExportCopyIncomplete } from './exportBoundedCopy';
import type { RetainedExportDirectory } from '../../../src/types/ipc/exportProgressWindow';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  IndeterminatePublicationError,
  describeExportStaging,
  publishExclusive,
} from './exportExclusivePublish';

export class PostCommitRecoveryError extends Error {
  constructor() { super('出力は保存されましたが、完了状態を復旧できないため処理を停止しました'); this.name = 'PostCommitRecoveryError'; }
}

/** Publish only a completed output, without replacing a file created by another job. */
export const publishExportOutput = async (
  outputPath: string,
  render: (stagingPath: string) => Promise<void>,
  signal?: AbortSignal,
  commit?: {
    begin: () => void;
    finish: (success: boolean) => void;
    cleanupFailed?: (record?: RetainedExportDirectory) => void;
    callbackFailed?: () => void;
  },
  publish: typeof publishExclusive = publishExclusive,
): Promise<void> => {
  signal?.throwIfAborted();
  const directory = await fs.mkdtemp(
    path.join(path.dirname(outputPath), '.sportag-export-'),
  );
  const stagingPath = path.join(directory, 'output.mp4');
  let committed = false;
  let uncertain = false;
  let retainCopy = false;
  let hasPrimaryError = false;
  let primaryError: unknown;
  let retained: Awaited<ReturnType<typeof describeExportStaging>> | undefined;
  try {
    retained = await describeExportStaging(directory, 'final-staging');
    await render(stagingPath);
    signal?.throwIfAborted();
    const result = await fs.lstat(stagingPath);
    if (!result.isFile() || result.size === 0) {
      throw new Error('Export did not produce a complete output');
    }
    // The staging directory is on the destination volume. link is atomic and
    // fails if the destination appeared after the name was allocated.
    // link is the commit point: cancellation before it prevents publication;
    // after it is issued, its result decides success or failure.
    signal?.throwIfAborted();
    commit?.begin();
    try {
      await publish(stagingPath, outputPath);
    } catch (error) {
      uncertain = error instanceof IndeterminatePublicationError;
      try { commit?.finish(false); } catch { /* Preserve the publication failure. */ }
      throw error;
    }
    committed = true;
    try { commit?.finish(true); }
    catch {
      try { commit?.callbackFailed?.(); } catch { throw new PostCommitRecoveryError(); }
      console.warn('[export] Publication succeeded but completion callback failed');
    }
  } catch (caught) {
    const error = normalizeExportError(caught);
    hasPrimaryError = true;
    primaryError = error;
    if ((error instanceof ExportCopyIncomplete && error.retainedPath) || retainedFor(error).directories.length || retainedFor(error).locationUnknown) {
      if (error instanceof ExportCopyIncomplete && error.retainedPath && !retainedFor(error).directories.length) rememberRetained(error);
      retainCopy = true;
      rememberRetained(error, retained ? { ...retained, reason: 'retained-after-failure' } : undefined);
    }
    if (error instanceof IndeterminatePublicationError) {
      uncertain = true;
      if (retained) error.retain(retained);
    }
    throw error;
  } finally {
    if (uncertain || retainCopy) {
      try { commit?.cleanupFailed?.(retained ? { ...retained, reason: 'retained-after-failure' } : undefined); }
      catch (error) { if (!hasPrimaryError) throw error; }
    } else {
      let cleanupFailed = false;
      await fs.unlink(stagingPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          cleanupFailed = true;
          console.warn('[export] Could not remove staging output', error.code);
        }
      });
      await fs.rmdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          cleanupFailed = true;
          console.warn(
            '[export] Could not remove staging directory',
            error.code,
          );
        }
      });
      if (cleanupFailed && hasPrimaryError)
        rememberRetained(primaryError, retained ? { ...retained, reason: 'cleanup-failed' } : undefined);
      if (cleanupFailed) {
        try { commit?.cleanupFailed?.(retained ? { ...retained, reason: 'cleanup-failed' } : undefined); }
        catch (error) { if (!hasPrimaryError) throw error; }
      }
      if (cleanupFailed && !committed && !hasPrimaryError)
        throw new Error('Export staging cleanup failed');
    }
  }
};
