import { readCacheFileIdentity } from './sourceIdentity';
import { probeCacheMetadata, probeCacheTiming } from './cacheProbe';
import type { CacheProbeContext } from './cacheProbe';
import type { CacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheSourceIdentity, CacheTimingProof } from './cachePolicy';
import { CACHE_RECIPE } from './cacheRecipe';

interface ContentProof {
  metadata: CacheMediaMetadata;
  timing: CacheTimingProof;
}
export interface CacheContentProof extends ContentProof {
  identity: CacheSourceIdentity;
  revision: string;
  observation: { reused: boolean; elapsedMs: number };
  /** Owner calls only after the remaining qualification gates succeed. */
  remember: () => void;
}

/** Main-memory proofs only. A fresh complete digest is required on every hit;
 * neither a disk manifest nor a file stamp can create a trusted proof. Runtime
 * changes/restarts miss. HW qualification is deliberately outside this memo. */
export class CacheContentProofs {
  private readonly entries = new Map<string, ContentProof>();

  async read(
    source: string,
    context: CacheProbeContext,
    runtime: string,
  ): Promise<CacheContentProof> {
    const started = performance.now();
    const before = await readCacheFileIdentity(source, {
      signal: context.signal,
    });
    const key = JSON.stringify([
      'full-content-proof-v1',
      CACHE_RECIPE,
      runtime,
      before.identity,
    ]);
    const saved = this.entries.get(key);
    if (saved) {
      context.signal.throwIfAborted();
      this.entries.delete(key);
      this.entries.set(key, saved);
      return {
        ...structuredClone(saved),
        ...before,
        observation: { reused: true, elapsedMs: performance.now() - started },
        remember: () => context.signal.throwIfAborted(),
      };
    }
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
    const proof = { metadata, timing };
    const retained = structuredClone(proof);
    return {
      ...proof,
      ...after,
      observation: { reused: false, elapsedMs: performance.now() - started },
      remember: () => {
        context.signal.throwIfAborted();
        this.entries.set(key, retained);
        // Only small metadata/digests are retained, never media buffers.
        if (this.entries.size > 8) {
          const oldest = this.entries.keys().next().value;
          if (oldest !== undefined) this.entries.delete(oldest);
        }
      },
    };
  }
}

export const cacheContentProofs = new CacheContentProofs();
