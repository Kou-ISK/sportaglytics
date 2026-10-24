import { CacheIdentityFile } from './cacheIdentityFile';
import type {
  CacheIdentityOptions,
  CacheFileIdentity,
} from './cacheIdentityFile';
import type { CacheSourceIdentity } from './cachePolicy';
export { cacheFileRevision } from './cacheFileRevision';
export type {
  CacheIdentityRead,
  CacheIdentityReadObserver,
} from './cacheIdentityFile';

/** Fresh complete-byte identity; caller must authorize the source and own cleanup. */
export const readCacheFileIdentity = async (
  source: string,
  options: CacheIdentityOptions = {},
): Promise<CacheFileIdentity> => {
  const file = new CacheIdentityFile(source, options);
  try {
    return await file.read();
  } finally {
    await file.close();
  }
};
export const identifyCacheSource = async (
  source: string,
  options: CacheIdentityOptions = {},
): Promise<CacheSourceIdentity> =>
  (await readCacheFileIdentity(source, options)).identity;
