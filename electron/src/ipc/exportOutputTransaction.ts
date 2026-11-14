import { normalizeExportError, rememberRetained, retainedFor } from './exportRetainedRecords';
import { exportPublicationScope } from './exportPublicationLease';
import type { ExportPublicationScope } from './exportPublicationLease';
import type { BigIntStats } from 'node:fs';
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
  constructor(readonly originalError?: unknown) { super('出力は保存されましたが、完了状態を復旧できないため処理を停止しました'); this.name = 'PostCommitRecoveryError'; }
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
    cleanupNotificationFailed?: () => void;
  },
  publish: typeof publishExclusive = publishExclusive,
): Promise<void> => {
  signal?.throwIfAborted();
  const directory = await fs.mkdtemp(
    path.join(path.dirname(outputPath), '.sportag-export-'),
  );
  const stagingPath = path.join(directory, 'output.mp4');
  const publicationScope: ExportPublicationScope = { stagingPath, accepting: true };
  let writtenIdentity: BigIntStats | undefined;
  let committed = false;
  let uncertain = false;
  let retainCopy = false;
  let hasPrimaryError = false;
  let primaryError: unknown;
  let retained: Awaited<ReturnType<typeof describeExportStaging>> | undefined;
  const notifyCleanupFailure = (record?: RetainedExportDirectory): void => {
    try {
      if (!commit?.cleanupFailed) throw new Error('Cleanup notification unavailable');
      commit.cleanupFailed(record);
    } catch (error) {
      if (hasPrimaryError) { rememberRetained(primaryError); return; }
      if (!committed) throw error;
      try {
        if (!commit?.cleanupNotificationFailed) throw error;
        commit.cleanupNotificationFailed();
      } catch (recoveryError) {
        const failure = new PostCommitRecoveryError(recoveryError);
        rememberRetained(failure);
        throw failure;
      }
    }
  };
  try {
    retained = await describeExportStaging(directory, 'final-staging');
    try { await exportPublicationScope.run(publicationScope, () => render(stagingPath)); }
    finally { publicationScope.accepting = false; }
    if (!publicationScope.lease) {
      writtenIdentity = await fs.lstat(stagingPath, { bigint: true });
      if (!writtenIdentity.isFile() || writtenIdentity.size === 0n)
        throw new Error('Export did not produce a complete output');
    }
    // The staging directory is on the destination volume. link is atomic and
    // fails if the destination appeared after the name was allocated.
    // link is the commit point: cancellation before it prevents publication;
    // after it is issued, its result decides success or failure.
    signal?.throwIfAborted();
    commit?.begin();
    try {
      if (publicationScope.lease) await publicationScope.lease.publish(outputPath);
      else await publish(stagingPath, outputPath);
    } catch (error) {
      uncertain = error instanceof IndeterminatePublicationError;
      try { commit?.finish(false); } catch { /* Preserve the publication failure. */ }
      throw error;
    }
    committed = true;
    try { commit?.finish(true); }
    catch (caught) {
      if (!commit?.callbackFailed) throw new PostCommitRecoveryError(caught);
      try { commit.callbackFailed(); } catch (error) { throw new PostCommitRecoveryError(error); }
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
    if (publicationScope.lease) {
      let leaseRecord: RetainedExportDirectory | undefined;
      let releaseFailed = false;
      try { leaseRecord = await publicationScope.lease.release(committed); }
      catch (error) {
        releaseFailed = true;
        if (hasPrimaryError) rememberRetained(primaryError);
        else if (!committed) throw error;
      }
      if (leaseRecord || releaseFailed) {
        if (hasPrimaryError) rememberRetained(primaryError, leaseRecord);
        notifyCleanupFailure(leaseRecord);
      }
    }
    if (uncertain || retainCopy) {
      notifyCleanupFailure(retained ? { ...retained, reason: 'retained-after-failure' } : undefined);
    } else {
      let cleanupFailed = false;
      let cleanupLocationKnown = false;
      // Creation/producer identities detect ordinary replacement. Path checks
      // are not an isolation boundary against a hostile same-UID process.
      try {
        const current = await fs.lstat(directory, { bigint: true });
        if (!retained || !current.isDirectory() || String(current.dev) !== retained.device || String(current.ino) !== retained.inode)
          throw new Error('Export staging directory changed');
        cleanupLocationKnown = true;
        if (!publicationScope.lease) {
          let entry: BigIntStats | undefined;
          try { entry = await fs.lstat(stagingPath, { bigint: true }); }
          catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
          if (entry) {
            if (!writtenIdentity || !entry.isFile() || entry.dev !== writtenIdentity.dev || entry.ino !== writtenIdentity.ino)
              throw new Error('Export staging output ownership is unconfirmed');
            await fs.unlink(stagingPath);
          }
        }
        // Lease mode never created stagingPath: do not delete a file appearing there.
        await fs.rmdir(directory);
      } catch { cleanupFailed = true; }
      if (cleanupFailed && hasPrimaryError)
        rememberRetained(primaryError, cleanupLocationKnown && retained ? { ...retained, reason: 'cleanup-failed' } : undefined);
      if (cleanupFailed) {
        notifyCleanupFailure(cleanupLocationKnown && retained ? { ...retained, reason: 'cleanup-failed' } : undefined);
      }
      if (cleanupFailed && !committed && !hasPrimaryError)
        throw new Error('Export staging cleanup failed');
    }
  }
};
