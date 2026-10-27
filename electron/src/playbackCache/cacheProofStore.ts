import {
  decodeCacheProofLedger,
  encodeCacheProofLedger,
  parseCacheContentData,
  CACHE_PROOF_BYTES,
} from './cacheProofRecord';
import type { CacheContentData } from './cacheProofRecord';
import {
  openCacheProofDirectory,
  readCacheProofFile,
  readOrCreateCacheProofKey,
  writeCacheProofFile,
} from './cacheProofIo';
import type { CacheProofWrite } from './cacheProofIo';

export interface CacheProofPersistence {
  read: (key: string, signal: AbortSignal) => Promise<CacheContentData | null>;
  write: (
    key: string,
    data: CacheContentData,
    signal: AbortSignal,
    record?: (outcome: CacheProofWrite) => void,
  ) => Promise<CacheProofWrite>;
}
// Main instances already have a single-instance lifecycle. Also serialize all
// store objects in this process by trusted profile, across windows/callers.
const queues = new Map<string, Promise<void>>();
export class CacheProofStore implements CacheProofPersistence {
  constructor(
    private readonly parent: () => string,
    private readonly scope: (signal: AbortSignal) => Promise<string | null>,
  ) {}
  private async run<T>(
    signal: AbortSignal,
    fallback: T,
    work: (parent: string, scope: string) => Promise<T>,
  ): Promise<T> {
    const parent = this.parent(),
      prior = queues.get(parent) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = prior.then(() => held);
    queues.set(parent, queued);
    await prior;
    try {
      signal.throwIfAborted();
      const scope = await this.scope(signal);
      signal.throwIfAborted();
      if (!scope) return fallback;
      const result = await work(parent, scope);
      signal.throwIfAborted();
      return result;
    } catch {
      signal.throwIfAborted();
      return fallback;
    } finally {
      release();
      if (queues.get(parent) === queued) queues.delete(parent);
    }
  }
  private async load(
    parent: string,
    scope: string,
    signal: AbortSignal,
  ): Promise<{
    directory: Awaited<ReturnType<typeof openCacheProofDirectory>>;
    key: Buffer;
    entries: Map<string, CacheContentData>;
  }> {
    const directory = await openCacheProofDirectory(parent, signal);
    signal.throwIfAborted();
    const key = await readOrCreateCacheProofKey(directory, signal),
      bytes = await readCacheProofFile(
        directory,
        'ledger.json',
        CACHE_PROOF_BYTES,
        signal,
      );
    let entries = new Map<string, CacheContentData>();
    if (bytes) {
      try {
        entries = decodeCacheProofLedger(bytes, key, scope);
      } catch {
        signal.throwIfAborted(); /* No authenticated complete ledger: recompute. */
      }
    }
    return { directory, key, entries };
  }
  read(key: string, signal: AbortSignal): Promise<CacheContentData | null> {
    return this.run(signal, null, async (parent, scope) => {
      const state = await this.load(parent, scope, signal);
      return structuredClone(state.entries.get(key) ?? null);
    });
  }
  write(
    key: string,
    data: CacheContentData,
    signal: AbortSignal,
    record?: (outcome: CacheProofWrite) => void,
  ): Promise<CacheProofWrite> {
    return this.run<CacheProofWrite>(
      signal,
      'not-stored',
      async (parent, scope) => {
        const state = await this.load(parent, scope, signal),
          retained = parseCacheContentData(data);
        state.entries.delete(key);
        state.entries.set(key, retained);
        if (state.entries.size > 8) {
          const oldest = state.entries.keys().next().value;
          if (oldest !== undefined) state.entries.delete(oldest);
        }
        return writeCacheProofFile(
          state.directory,
          encodeCacheProofLedger(state.entries, state.key, scope),
          signal,
          record,
        );
      },
    );
  }
}
