import { AsyncLocalStorage } from 'node:async_hooks';
import { stat, statfs } from 'node:fs/promises';
import * as os from 'node:os';

/** Operational stop thresholds, not a disk reservation or a hard quota. */
export interface ExportResources {
  signal: AbortSignal;
  maxFileBytes: number;
  minFreeBytes: number;
  check: () => Promise<void>;
}
export const exportResourceContext = new AsyncLocalStorage<ExportResources>();
export const createExportResources = async (destination: string, signal: AbortSignal, reserveBytes = 2 * 1024 ** 3, candidateOnDestination = false): Promise<ExportResources> => {
  const directories = [...new Set([os.tmpdir(), destination])];
  if (!Number.isSafeInteger(reserveBytes) || reserveBytes < 2 * 1024 ** 3) throw new Error('Invalid reserve');
  const minFreeBytes = reserveBytes;
  const snapshot = async (): Promise<{ free: number; device: number }[]> => {
    signal.throwIfAborted();
    const values = await Promise.all(directories.map(async (directory) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const [volume, identity] = await Promise.race([
          Promise.all([statfs(directory), stat(directory)]),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('capacity inspection timeout')), 2000); }),
        ]);
        const free = volume.bavail * volume.bsize;
        if (!Number.isSafeInteger(free) || free <= minFreeBytes) throw new Error('insufficient free space');
        return { free, device: identity.dev };
      } finally { if (timer) clearTimeout(timer); }
    }));
    signal.throwIfAborted();
    return values;
  };
  const initial = await snapshot();
  // Candidate and output may coexist. On one volume account for two copies;
  // on separate volumes each holds one. Other files and processes can still grow.
  const sameVolume = new Set(initial.map((item) => item.device)).size === 1;
  const maxFileBytes = Math.floor(Math.min(...initial.map((item) => item.free - minFreeBytes)) / (sameVolume && !candidateOnDestination ? 2 : 1));
  if (maxFileBytes < 1) throw new Error('insufficient free space');
  return { signal, maxFileBytes, minFreeBytes, check: async () => { await snapshot(); } };
};
