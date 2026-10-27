import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  NativeClipExporter,
  NativeClipExportRequest,
} from './nativeClipExport';
import {
  NativeExportCancelled,
  runNativeExportProcess,
} from './nativeExportProcess';

export interface NativeExportReceipt {
  version: 1;
  status: 'completed';
  duration: number;
  audioTrack: number;
}

const isReceipt = (
  value: unknown,
  request: NativeClipExportRequest,
): value is NativeExportReceipt => {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'version' in value &&
    value.version === 1 &&
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
      return { status: 'fallback', reason: 'source-unavailable' };
    }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink())
      return { status: 'fallback', reason: 'unsupported-source-type' };
    const before = await revision(request.sourcePath);
    const sourceSize = (await fs.lstat(request.sourcePath)).size;
    const maxOutputBytes = Math.min(8 * 1024 ** 3, sourceSize + 16 * 1024 ** 2);
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'sportaglytics-native-export-'),
    );
    try {
      const candidate = path.join(directory, 'candidate.mp4');
      const manifest = path.join(directory, 'request.json');
      await fs.writeFile(
        manifest,
        JSON.stringify({
          version: 1,
          source: request.sourcePath,
          output: candidate,
          audioTrack: request.audioTrack,
          start: request.start,
          duration: request.duration,
          maxOutputBytes,
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
          }),
        );
      } catch (error) {
        if (before !== (await revision(request.sourcePath)))
          throw Error('Export source changed');
        assertActive();
        if (error instanceof NativeExportCancelled) throw error;
        return { status: 'fallback', reason: 'native-failed' };
      }
      assertActive();
      if (before !== (await revision(request.sourcePath)))
        throw Error('Export source changed');
      if (!isReceipt(receipt, request))
        return { status: 'fallback', reason: 'native-unqualified' };
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
      if (!qualified)
        return { status: 'fallback', reason: 'output-unqualified' };
      // Copy beside the destination, then publish a complete file exclusively.
      // Cancellation during a large cross-volume copy cannot expose a partial
      // final output. Only this call's staging directory is removed.
      const publication = await fs.mkdtemp(
        path.join(path.dirname(request.outputPath), '.sportaglytics-export-'),
      );
      try {
        const staged = path.join(publication, 'clip.mp4');
        await fs.copyFile(candidate, staged, constants.COPYFILE_EXCL);
        if (before !== (await revision(request.sourcePath)))
          throw Error('Export source changed during publication');
        assertActive();
        try {
          await fs.link(staged, request.outputPath);
        } catch (error) {
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
          const own = await fs.lstat(staged);
          const current = await fs.lstat(request.outputPath);
          if (own.dev === current.dev && own.ino === current.ino)
            await fs.unlink(request.outputPath);
          throw new NativeExportCancelled();
        }
      } finally {
        await fs.rm(publication, { recursive: true, force: true });
      }
      return { status: 'completed' };
    } finally {
      // run resolves/rejects after process close, so it no longer owns this directory.
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
