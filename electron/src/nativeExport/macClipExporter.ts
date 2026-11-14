import { normalizeExportError, rememberRetained, transferRetained } from '../ipc/exportRetainedRecords';
import { exportResourceContext } from '../ipc/exportResourceContext';
import { copyWithBudget, ExportCopyIncomplete } from '../ipc/exportBoundedCopy';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  describeExportStaging,
  IndeterminatePublicationError,
  publishExclusive,
} from '../ipc/exportExclusivePublish';
import { NativeExportUnknownFailure } from './nativeClipExport';
import { nativeMinimumFreeBytes } from './nativeCapacityPolicy';
import type {
  NativeClipExporter,
  NativeClipExportRequest,
} from './nativeClipExport';
import {
  NativeExportCancelled,
  NativeExportCapacityError,
  runNativeExportProcess,
} from './nativeExportProcess';

export interface NativeExportReceipt {
  version: 1 | 2;
  status: 'completed';
  duration: number;
  audioTrack: number;
}

const isReceipt = (
  value: unknown,
  request: NativeClipExportRequest,
  version: 1 | 2,
): value is NativeExportReceipt => {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'version' in value &&
    value.version === version &&
    'status' in value &&
    value.status === 'completed' &&
    'duration' in value &&
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    Math.abs(value.duration - request.duration) <= 1 / 120000 &&
    'audioTrack' in value &&
    value.audioTrack === request.audioTrack
  );
};

interface MacClipExporterOptions {
  executable: string;
  /** Required independent admission. Completion/metadata alone cannot qualify pixels or audio. */
  qualify: (
    candidatePath: string,
    request: NativeClipExportRequest,
    receipt: NativeExportReceipt,
  ) => Promise<boolean>;
  run?: typeof runNativeExportProcess;
  /** Main must verify helper capability and establish the v2 resource context. */
  experimentalBudget?: { maxBytes: number; deadlineSeconds: number };
  expectedSourceRevision?: string;
}

const revision = async (file: string): Promise<string> => {
  const stat = await fs.lstat(file, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink())
    throw Error('Regular export source required');
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
};

/** Main-owned exact-range candidate. Failed optimization never publishes output. */
export const createMacClipExporter =
  ({
    executable,
    qualify,
    run = runNativeExportProcess,
    experimentalBudget,
    expectedSourceRevision,
  }: MacClipExporterOptions): NativeClipExporter =>
  async (request) => {
    const assertActive = (): void => {
      if (request.signal?.aborted) throw new NativeExportCancelled();
    };
    assertActive();
    if (process.platform !== 'darwin')
      return { status: 'fallback', reason: 'platform' };
    if (
      !Number.isFinite(request.start) ||
      request.start < 0 ||
      !Number.isFinite(request.duration) ||
      request.duration <= 0 ||
      request.duration > 7200 ||
      !Number.isInteger(request.audioTrack) ||
      request.audioTrack < 0 ||
      request.audioTrack > 63
    )
      return { status: 'fallback', reason: 'unsupported-request' };
    if (!path.isAbsolute(request.sourcePath))
      return { status: 'fallback', reason: 'non-local-source' };
    let sourceStat;
    try {
      sourceStat = await fs.lstat(request.sourcePath);
    } catch {
      if (expectedSourceRevision !== undefined) throw new NativeExportCapacityError('Source unavailable after estimation');
      return { status: 'fallback', reason: 'source-unavailable' };
    }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      if (expectedSourceRevision !== undefined) throw new NativeExportCapacityError('Source changed after estimation');
      return { status: 'fallback', reason: 'unsupported-source-type' };
    }
    const resources = exportResourceContext.getStore();
    await resources?.check();
    const before = await revision(request.sourcePath);
    if (expectedSourceRevision !== undefined && before !== expectedSourceRevision) throw new NativeExportCapacityError('Source changed after estimation');
    const sourceSize = (await fs.lstat(request.sourcePath)).size;
    if (experimentalBudget && (!resources || resources.minFreeBytes < nativeMinimumFreeBytes(experimentalBudget.maxBytes) || !Number.isSafeInteger(experimentalBudget.maxBytes) || experimentalBudget.maxBytes < 1 || experimentalBudget.maxBytes > 32 * 1024 ** 3 || !Number.isSafeInteger(experimentalBudget.deadlineSeconds) || experimentalBudget.deadlineSeconds < 1 || experimentalBudget.deadlineSeconds > 600 || experimentalBudget.maxBytes > resources.maxFileBytes)) throw new Error('Invalid experimental native budget');
    const version = experimentalBudget ? 2 : 1;
    const maxOutputBytes = Math.min(experimentalBudget?.maxBytes ?? 8 * 1024 ** 3, sourceSize + 16 * 1024 ** 2, resources?.maxFileBytes ?? Number.MAX_SAFE_INTEGER);
    const directory = await fs.mkdtemp(
      experimentalBudget
        ? path.join(path.dirname(request.outputPath), '.sportaglytics-export-')
        : path.join(os.tmpdir(), 'sportaglytics-native-export-'),
    );
    let publicationUncertain = false;
    let retainUnknown = false;
    let publicationError: IndeterminatePublicationError | undefined;
    let nativeTemp:
      | Awaited<ReturnType<typeof describeExportStaging>>
      | undefined;
    try {
      nativeTemp = await describeExportStaging(
        directory,
        'native-temp',
        'cleanup-failed',
      );
      const candidate = path.join(directory, experimentalBudget ? 'clip.mp4' : 'candidate.mp4');
      const manifest = path.join(directory, 'request.json');
      await fs.writeFile(
        manifest,
        JSON.stringify({
          version,
          source: request.sourcePath,
          output: candidate,
          audioTrack: request.audioTrack,
          start: request.start,
          duration: request.duration,
          maxOutputBytes,
          ...(experimentalBudget ? { deadlineSeconds: experimentalBudget.deadlineSeconds } : {}),
        }),
        { flag: 'wx' },
      );
      let receipt: unknown;
      try {
        receipt = JSON.parse(
          await run(executable, manifest, {
            signal: request.signal,
            outputPath: candidate,
            maxOutputBytes,
            ...(experimentalBudget && resources ? { minimumFreeBytes: resources.minFreeBytes } : {}),
            ...(experimentalBudget ? { timeoutMs: (experimentalBudget.deadlineSeconds + 10) * 1000 } : {}),
            reserveDirectories: [path.dirname(request.outputPath)],
          }),
        );
      } catch (caught) {
        const error = normalizeExportError(caught);
        // A helper failure may be capacity-related even when it provided no
        // receipt. Keep its working directory and never start another encoder.
        retainUnknown = true;
        if (error instanceof NativeExportCancelled || error instanceof NativeExportCapacityError) {
          rememberRetained(error, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined);
          throw error;
        }
        try {
          if (before !== (await revision(request.sourcePath)))
            { const wrapped = new NativeExportUnknownFailure(error, 'Export source changed'); transferRetained(error, wrapped); rememberRetained(wrapped, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined); throw wrapped; }
        } catch (revisionError) {
          if (revisionError instanceof NativeExportUnknownFailure) throw revisionError;
          const wrapped = new NativeExportUnknownFailure(error); transferRetained(error, wrapped); rememberRetained(wrapped, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined); throw wrapped;
        }
        const wrapped = new NativeExportUnknownFailure(error); transferRetained(error, wrapped); rememberRetained(wrapped, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined); throw wrapped;
      }
      assertActive();
      if (before !== (await revision(request.sourcePath)))
        throw Error('Export source changed');
      const unsupportedReason = typeof receipt === 'object' && receipt !== null && !Array.isArray(receipt)
        && JSON.stringify(Object.keys(receipt).sort()) === JSON.stringify(['reason', 'status', 'version'])
        && 'version' in receipt && receipt.version === version
        && 'status' in receipt && receipt.status === 'unsupported'
        && 'reason' in receipt && (receipt.reason === 'no-audio' || receipt.reason === 'range-not-covered') ? receipt.reason : undefined;
      if (unsupportedReason) {
        assertActive();
        try {
          await fs.lstat(candidate);
          throw new NativeExportUnknownFailure(receipt, 'Unexpected candidate for unsupported media');
        } catch (error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
        }
        assertActive();
        if (before !== (await revision(request.sourcePath))) throw new NativeExportUnknownFailure(receipt, 'Export source changed');
        return { status: 'fallback', reason: unsupportedReason === 'no-audio' ? 'native-pre-output-unsupported' : 'native-range-not-covered' };
      }
      if (!isReceipt(receipt, request, version))
        throw new NativeExportUnknownFailure(receipt, 'Invalid native export receipt');
      let qualified = false;
      let admissionError: unknown;
      try {
        const output = await fs.lstat(candidate);
        qualified =
          output.isFile() &&
          !output.isSymbolicLink() &&
          output.size > 0 &&
          output.size <= maxOutputBytes &&
          (await qualify(candidate, request, receipt));
      } catch (error) {
        // A missing/partial candidate or failed metadata probe is an
        // optimization failure. Source mutation/cancellation below remain fatal.
        admissionError = error;
      }
      if (before !== (await revision(request.sourcePath)))
        throw Error('Export source changed during qualification');
      assertActive();
      if (admissionError instanceof NativeExportCancelled) throw admissionError;
      if (!qualified) {
        if (experimentalBudget) throw new NativeExportUnknownFailure(admissionError, 'Native output was not qualified');
        return { status: 'fallback', reason: 'output-unqualified' };
      }
      if (experimentalBudget) {
        // The private candidate is already on the staging destination's volume.
        // Only publish a complete qualified file; the outer transaction owns the
        // final name and remains responsible for commit and cancellation.
        assertActive();
        try {
          await publishExclusive(candidate, request.outputPath);
        } catch (error) {
          if (error instanceof IndeterminatePublicationError) {
            publicationUncertain = true;
            retainUnknown = true;
            publicationError = error;
            if (nativeTemp) error.retain(nativeTemp);
          }
          throw error;
        }
        assertActive();
        return { status: 'completed' };
      }
      // Copy beside the destination, then publish a complete file exclusively.
      // Cancellation during a large cross-volume copy cannot expose a partial
      // final output. Only this call's staging directory is removed.
      const publication = await fs.mkdtemp(
        path.join(path.dirname(request.outputPath), '.sportaglytics-export-'),
      );
      let uncertain = false;
      let retainCopy = false;
      let publicationRecord: Awaited<ReturnType<typeof describeExportStaging>> | undefined;
      try {
        const retained = await describeExportStaging(
          publication,
          'native-staging',
        );
        publicationRecord = retained;
        const staged = path.join(publication, 'clip.mp4');
        try {
          if (resources) {
            await copyWithBudget(candidate, staged, { maxBytes: resources.maxFileBytes, minimumFreeBytes: resources.minFreeBytes, signal: resources.signal });
          } else {
            await fs.copyFile(candidate, staged, constants.COPYFILE_EXCL);
          }
        } catch (caught) {
          const error = normalizeExportError(caught);
          if (error instanceof ExportCopyIncomplete && error.retainedPath) {
            retainCopy = true;
            retainUnknown = true;
            rememberRetained(error, { ...retained, reason: 'retained-after-failure' });
            rememberRetained(error, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined);
          }
          throw error;
        }
        if (before !== (await revision(request.sourcePath)))
          throw Error('Export source changed during publication');
        assertActive();
        try {
          await publishExclusive(staged, request.outputPath);
        } catch (error) {
          if (error instanceof IndeterminatePublicationError) {
            uncertain = true;
            publicationUncertain = true;
            publicationError = error;
            error.retain(retained);
            throw error;
          }
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            ['ENOTSUP', 'EOPNOTSUPP', 'EPERM'].includes(String(error.code))
          ) {
            assertActive();
            return {
              status: 'fallback',
              reason: 'output-storage-incompatible',
            };
          }
          throw error; // In particular, EEXIST must never overwrite or fallback.
        }
        if (request.signal?.aborted) {
          // The outer transaction owns this path and will discard it on abort.
          throw new NativeExportCancelled();
        }
      } catch (caught) {
        const error = normalizeExportError(caught);
        if (!uncertain) {
          retainCopy = true;
          retainUnknown = true;
          rememberRetained(error, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined);
          rememberRetained(error, publicationRecord ? { ...publicationRecord, reason: 'retained-after-failure' } : undefined);
        }
        throw error;
      } finally {
        if (!uncertain && !retainCopy) {
          try { await fs.rm(publication, { recursive: true, force: true }); }
          catch (caught) {
            const error = normalizeExportError(caught);
            rememberRetained(error, publicationRecord ? { ...publicationRecord, reason: 'cleanup-failed' } : undefined);
            throw error;
          }
        }
      }
      return { status: 'completed' };
    } catch (caught) {
      const error = normalizeExportError(caught);
      if (!publicationUncertain) {
        retainUnknown = true;
        rememberRetained(error, nativeTemp ? { ...nativeTemp, reason: 'retained-after-failure' } : undefined);
      }
      throw error;
    } finally {
      // run resolves/rejects after process close, so it no longer owns this directory.
      try {
        if (!retainUnknown) await fs.rm(directory, { recursive: true, force: true });
      } catch (caught) {
        const error = normalizeExportError(caught);
        if (!publicationUncertain) {
          rememberRetained(error, nativeTemp ? { ...nativeTemp, reason: 'cleanup-failed' } : undefined);
          throw error;
        }
        if (nativeTemp && publicationError) publicationError.retain(nativeTemp);
        console.warn(
          '[export] Native temporary cleanup failed after uncertain publication',
        );
      }
    }
  };
