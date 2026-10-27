import { app } from 'electron';
import { CacheContentProofs } from './cacheContentProofs';
import { CacheProofStore } from './cacheProofStore';
import {
  readCacheApplicationIdentity,
  isCacheApplicationCurrent,
} from './cacheApplicationIdentity';
import type { CacheApplicationIdentity } from './cacheApplicationIdentity';

// No proof survives a packaged application change, including validator edits.
// Development directories use only in-memory proofs. Live ASAR replacement is
// unsupported: a detected revision change disables persistence for this Main.
let build: CacheApplicationIdentity | null | undefined;
let invalidated = false;
const scope = async (signal: AbortSignal): Promise<string | null> => {
  if (invalidated) return null;
  try {
    // Store access is serialized per Main profile; never cache an aborted promise.
    if (build === undefined)
      build = await readCacheApplicationIdentity(app.getAppPath(), signal);
    signal.throwIfAborted();
    const value = build;
    if (!value) return null;
    if (
      app.getAppPath() !== value.path ||
      !(await isCacheApplicationCurrent(value, signal))
    ) {
      invalidated = true;
      return null;
    }
    return value.scope;
  } catch {
    signal.throwIfAborted();
    invalidated = true;
    return null;
  }
};
export const cacheContentProofs = new CacheContentProofs(
  new CacheProofStore(() => app.getPath('userData'), scope),
);
