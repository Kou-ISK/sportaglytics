import { readCacheFileIdentity } from './sourceIdentity';
import { probeCacheMetadata, probeCacheTiming } from './cacheProbe';
import type { CacheProbeContext } from './cacheProbe';
import type { CacheSourceIdentity } from './cachePolicy';
import { cacheContentKey } from './cacheProofRecord';
import type { CacheContentData } from './cacheProofRecord';
import type { CacheProofPersistence } from './cacheProofStore';
import type { CacheProofWrite } from './cacheProofIo';

export interface CacheProofObservation {
  reused: boolean;
  from: 'fresh' | 'memory' | 'persistent';
  persistence: CacheProofWrite | 'not-requested';
  elapsedMs: number;
}
export interface CacheContentProof extends CacheContentData {
  identity: CacheSourceIdentity;
  revision: string;
  observation: CacheProofObservation;
  /** Owner calls only after the remaining qualification gates succeed. */
  remember: () => Promise<void>;
}

/** Fresh whole-byte identity is mandatory even on authenticated disk hits.
 * HW, source ownership and final identity checks remain outside this memo. */
export class CacheContentProofs {
  private readonly entries = new Map<string, CacheContentData>();
  constructor(private readonly disk?: CacheProofPersistence) {}

  async read(
    source: string,
    context: CacheProbeContext,
    runtime: string,
  ): Promise<CacheContentProof> {
    const started = performance.now();
    const before = await readCacheFileIdentity(source, {
      signal: context.signal,
    });
    const key = cacheContentKey(runtime, before.identity);
    const memory = this.entries.get(key);
    if (memory) {
      this.entries.delete(key);
      this.entries.set(key, memory);
    }
    const saved = memory ?? (await this.disk?.read(key, context.signal));
    context.signal.throwIfAborted();
    const from = memory ? 'memory' : saved ? 'persistent' : 'fresh';
    const qualify = (
      proof: CacheContentData,
      identity: typeof before,
    ): CacheContentProof => {
      const retained = structuredClone(proof);
      const observation: CacheProofObservation = {
        reused: from !== 'fresh',
        from,
        persistence: from === 'persistent' ? 'stored' : 'not-requested',
        elapsedMs: performance.now() - started,
      };
      return {
        ...structuredClone(proof),
        ...identity,
        observation,
        remember: async () => {
          context.signal.throwIfAborted();
          if (this.disk)
            observation.persistence = await this.disk.write(
              key,
              retained,
              context.signal,
              (outcome) => {
                observation.persistence = outcome;
              },
            );
          context.signal.throwIfAborted();
          this.entries.delete(key);
          this.entries.set(key, retained);
          if (this.entries.size > 8) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
          }
        },
      };
    };
    if (saved) return qualify(saved, before);
    const metadata = await probeCacheMetadata(source, context);
    const timing = await probeCacheTiming(source, metadata, context);
    const after = await readCacheFileIdentity(source, {
      signal: context.signal,
    });
    if (
      before.revision !== after.revision ||
      before.identity.sha256 !== after.identity.sha256 ||
      before.identity.bytes !== after.identity.bytes
    )
      throw Error('CACHE_CONTENT_CHANGED');
    context.signal.throwIfAborted();
    return qualify({ metadata, timing }, after);
  }
}
