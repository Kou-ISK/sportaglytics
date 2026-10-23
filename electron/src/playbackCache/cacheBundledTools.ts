import path from 'node:path';
import { app } from 'electron';
import { readCacheFileIdentity } from './sourceIdentity';

/** No environment/PATH fallback. Qualification uses the same binaries shipped
 * with this app, and binds their complete hashes to the runtime proof. */
export const identifyCacheTools = async (
  signal: AbortSignal,
): Promise<{
  ffmpeg: string;
  ffprobe: string;
  runtime: string;
}> => {
  if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch))
    throw Error('CACHE_PLATFORM_UNSUPPORTED');
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'media-tools')
    : path.resolve(
        app.getAppPath(),
        '.cache',
        'media-tools',
        'darwin-' + process.arch,
      );
  const ffmpeg = path.join(root, 'ffmpeg');
  const ffprobe = path.join(root, 'ffprobe');
  const encoder = await readCacheFileIdentity(ffmpeg, { signal });
  const probe = await readCacheFileIdentity(ffprobe, { signal });
  return {
    ffmpeg,
    ffprobe,
    runtime: [
      'electron',
      process.versions.electron,
      'chrome',
      process.versions.chrome,
      process.platform,
      process.arch,
      encoder.identity.sha256,
      probe.identity.sha256,
    ].join(':'),
  };
};
