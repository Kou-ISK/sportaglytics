import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  NativeClipExporter,
  NativeClipExportRequest,
} from './nativeClipExport';
import { runNativeExportProcess } from './nativeExportProcess';

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

/** Optional private integration; normal app does not supply this provider or a helper. */
export const createMacClipExporter =
  ({
    executable,
    qualify,
    run = runNativeExportProcess,
  }: MacClipExporterOptions): NativeClipExporter =>
  async (request) => {
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
    const before = await revision(request.sourcePath);
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
        }),
        { flag: 'wx' },
      );
      let receipt: unknown;
      try {
        receipt = JSON.parse(await run(executable, manifest));
      } catch {
        if (before !== (await revision(request.sourcePath)))
          throw Error('Export source changed');
        return { status: 'fallback', reason: 'native-failed' };
      }
      if (before !== (await revision(request.sourcePath)))
        throw Error('Export source changed');
      if (!isReceipt(receipt, request))
        return { status: 'fallback', reason: 'native-unqualified' };
      const output = await fs.lstat(candidate);
      const qualified =
        output.isFile() &&
        !output.isSymbolicLink() &&
        output.size > 0 &&
        (await qualify(candidate, request, receipt));
      if (before !== (await revision(request.sourcePath)))
        throw Error('Export source changed during qualification');
      if (!qualified)
        return { status: 'fallback', reason: 'output-unqualified' };
      // Do not overwrite an existing destination, including the original source.
      await fs.copyFile(candidate, request.outputPath, constants.COPYFILE_EXCL);
      return { status: 'completed' };
    } finally {
      // run resolves/rejects after process close, so it no longer owns this directory.
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
