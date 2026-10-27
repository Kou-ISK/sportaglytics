import { spawn } from 'node:child_process';
import path from 'node:path';
import type { CacheWorker, CacheWorkerEvents } from './cacheConversionRunner';

/** Main-only adapter. The caller supplies the bundled executable and a fixed,
 * validated recipe with -progress pipe:1, an authorized source, and an owned
 * staging output. This is not an IPC surface or a renderer command runner. */
export const spawnCacheWorker = (
  executable: string,
  args: readonly string[],
  events: CacheWorkerEvents,
): CacheWorker => {
  if (!path.isAbsolute(executable)) throw new Error('CACHE_INVALID_EXECUTABLE');
  const child = spawn(executable, [...args], {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Own error/close before inspecting pipes: failed spawn can omit them.
  child.on('error', events.error);
  child.once('close', events.closed);
  const stdout = child.stdout;
  const stderr = child.stderr;
  const progress = (chunk: Buffer): void => events.output('progress', chunk);
  const diagnostic = (chunk: Buffer): void =>
    events.output('diagnostic', chunk);
  stdout?.on('error', events.error);
  stderr?.on('error', events.error);
  stdout?.on('data', progress);
  stderr?.on('data', diagnostic);
  // Report failure without throwing after child creation. The runner must
  // retain ownership and wait for close before staging cleanup or retry.
  if (!stdout || !stderr)
    events.error(new Error('CACHE_WORKER_PIPE_UNAVAILABLE'));
  return {
    terminate: () => child.kill('SIGTERM'),
    dispose: () => {
      stdout?.off('data', progress);
      stderr?.off('data', diagnostic);
      stdout?.off('error', events.error);
      stderr?.off('error', events.error);
      child.off('error', events.error);
      child.off('close', events.closed);
    },
  };
};
