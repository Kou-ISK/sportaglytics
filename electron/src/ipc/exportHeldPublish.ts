import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runNativeExportProbe } from '../nativeExport/nativeExportProcess';
import { IndeterminatePublicationError } from './exportExclusivePublish';

/** Only a previously signature/hash-verified host may be passed by production. */
export const publishHeldSource = async (
  host: string,
  sourceFd: number,
  target: string,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(sourceFd) || sourceFd < 0 || !path.isAbsolute(target))
    throw new Error('Invalid held publication input');
  const parent = await fs.open(path.dirname(target), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let started = false;
  let failure: unknown;
  try {
    const parentIdentity = await parent.stat({ bigint: true });
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      // The caller must retain sourceFd until this promise settles at child close.
      const child = spawn(host, ['--publish-held-v1', path.basename(target)], {
        stdio: ['ignore', 'pipe', 'pipe', sourceFd, parent.fd],
        windowsHide: true,
      });
      started = true;
      let stdout = '';
      let observedBytes = 0;
      let invalidOutput = false;
      let stopped = false;
      let spawnError: Error | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const stop = (): void => {
        if (stopped) return;
        stopped = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
        killTimer.unref();
      };
      const timer = setTimeout(stop, 30000);
      timer.unref();
      const onAbort = (): void => stop();
      signal?.addEventListener('abort', onAbort, { once: true });
      const observe = (bytes: Buffer, isStdout: boolean): void => {
        observedBytes += bytes.byteLength;
        if (observedBytes > 4096) { invalidOutput = true; stop(); return; }
        if (isStdout) stdout += bytes.toString('utf8');
      };
      child.stdout?.on('data', (bytes: Buffer) => observe(bytes, true));
      child.stderr?.on('data', (bytes: Buffer) => observe(bytes, false));
      child.once('error', (error) => { spawnError = error; });
      child.once('close', (code, closeSignal) => {
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        signal?.removeEventListener('abort', onAbort);
        // A confirmed commit wins a concurrent cancellation. Missing or malformed
        // receipts are uncertain, even when a destination seems to exist.
        if (!spawnError && !invalidOutput && code === 0 && !closeSignal && stdout === 'HELD1:OK\n') { resolve(); return; }
        if (!spawnError && !stopped && !invalidOutput && !closeSignal && stdout === '') {
          if (code === 73) { reject(Object.assign(new Error('Export destination already exists'), { code: 'EEXIST' })); return; }
          if (code === 64 || code === 78) { reject(Object.assign(new Error('Held publication is not supported'), { code: 'ENOTSUP' })); return; }
          if (code === 74) { reject(new Error('Export descriptor validation failed')); return; }
        }
        reject(Object.assign(new IndeterminatePublicationError(), { cause: spawnError, exitCode: code, signal: closeSignal }));
      });
      if (signal?.aborted) stop();
    });
    try {
      const currentParent = await fs.lstat(path.dirname(target), { bigint: true });
      if (currentParent.dev !== parentIdentity.dev || currentParent.ino !== parentIdentity.ino)
        throw new Error('Export destination directory changed');
    } catch (cause) { throw Object.assign(new IndeterminatePublicationError(), { cause }); }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try { await parent.close(); }
    catch (cause) {
      // Do not allow an uncertain close to invite publication retry or cleanup.
      if (failure !== undefined) {
        if (failure instanceof Error) Object.assign(failure, { closeError: cause });
      } else if (started) throw Object.assign(new IndeterminatePublicationError(), { cause });
      else throw cause;
    }
  }
};

/** Read-only preflight; actual clone may still fail after the volume changes. */
export const supportsHeldPublicationVolume = async (host: string, directory: string, signal?: AbortSignal): Promise<boolean> => {
  signal?.throwIfAborted();
  const held = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const response = await runNativeExportProbe(host, ['--held-publication-volume'], signal, held.fd);
    if (response === 'HELD1:APFS\n') return true;
    if (response === 'HELD1:UNSUPPORTED\n') return false;
    throw new Error('Invalid publication volume capability');
  } finally { await held.close(); }
};
