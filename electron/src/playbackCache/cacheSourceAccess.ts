import { CacheMp4BoxReader } from './cacheMp4Boxes';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  objectValue,
  stringValue,
  arrayValue,
} from '../../../src/shared/validation/jsonValues';
import { isPackageCaptureActive } from '../liveCapture/captureRegistry';
import { isPackageUpdating } from '../ipc/packageUpdateLeases';
import { cacheFileRevision } from './sourceIdentity';

const parseConfig = (
  value: unknown,
): { angleId: string; clipId: string; relativePath: string } => {
  const config = objectValue(value);
  const angle = objectValue(arrayValue(config.angles, 1, 1)[0]);
  const clip = objectValue(arrayValue(angle.clips, 1, 1)[0]);
  if (
    (angle.sourceKind !== undefined && angle.sourceKind !== 'local') ||
    clip.sourceKind !== 'local'
  )
    throw Error('CACHE_UNSUPPORTED_PACKAGE');
  return {
    angleId: stringValue(angle.id, 1, 128),
    clipId: stringValue(clip.id, 1, 128),
    relativePath: stringValue(clip.relativePath, 1, 4096),
  };
};
export interface CacheAuthorizedSource {
  key: string;
  path: string;
  url: string;
  label: string;
  revision: string;
  bytes: number;
  assertCurrent: () => Promise<void>;
}
const readConfig = async (file: string): Promise<Buffer> => {
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1024 * 1024)
      throw Error('CACHE_UNSUPPORTED_PACKAGE');
    const bytes = Buffer.alloc(info.size + 1);
    const { bytesRead } = await handle.read(bytes);
    if (bytesRead !== info.size) throw Error('CACHE_PACKAGE_CHANGED');
    return bytes.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};
/** Caller has authenticated the main document and bound Session. This resolver
 * only admits one package-owned closed local clip, with no symlink ancestors. */
export const resolveCacheSource = async (
  packagePath: string,
): Promise<CacheAuthorizedSource> => {
  if (isPackageCaptureActive(packagePath) || isPackageUpdating(packagePath))
    throw Error('CACHE_PACKAGE_BUSY');
  const root = await fs.realpath(packagePath);
  const configPath = path.join(root, '.metadata', 'config.json');
  if ((await fs.lstat(path.dirname(configPath))).isSymbolicLink())
    throw Error('CACHE_UNSAFE_PACKAGE');
  const raw = await readConfig(configPath);
  const config = parseConfig(JSON.parse(raw.toString('utf8')));
  const source = path.resolve(root, config.relativePath);
  const relative = path.relative(root, source);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    path.extname(source).toLowerCase() !== '.mp4'
  )
    throw Error('CACHE_UNSUPPORTED_SOURCE');
  const inspect = async (): Promise<string> => {
    if (isPackageCaptureActive(packagePath) || isPackageUpdating(packagePath))
      throw Error('CACHE_PACKAGE_BUSY');
    let location = root;
    for (const component of relative.split(path.sep)) {
      location = path.join(location, component);
      if ((await fs.lstat(location)).isSymbolicLink())
        throw Error('CACHE_UNSAFE_SOURCE');
    }
    const info = await fs.lstat(source, { bigint: true });
    if (!info.isFile() || info.size <= 0n || info.size > 512n * 1024n * 1024n)
      throw Error('CACHE_SOURCE_SCOPE_LIMIT');
    return cacheFileRevision(info);
  };
  const revision = await inspect();
  const fingerprint = createHash('sha256').update(raw).digest('hex');
  return {
    key: createHash('sha256')
      .update(
        JSON.stringify([config.angleId, config.clipId, fingerprint, revision]),
      )
      .digest('hex'),
    path: source,
    url: pathToFileURL(source).href,
    label: path.basename(source),
    revision,
    bytes: Number((await fs.lstat(source)).size),
    assertCurrent: async () => {
      if ((await fs.lstat(path.dirname(configPath))).isSymbolicLink())
        throw Error('CACHE_UNSAFE_PACKAGE');
      if (
        (await fs.realpath(packagePath)) !== root ||
        (await inspect()) !== revision ||
        createHash('sha256')
          .update(await readConfig(configPath))
          .digest('hex') !== fingerprint
      )
        throw Error('CACHE_SOURCE_CHANGED');
    },
  };
};

/** Reject fragmented MP4/MSE recordings before any conversion. Read bounded box
 * prefixes only; validate all bounds and cap the header count. */
export const assertClosedMp4 = async (
  file: string,
  signal?: AbortSignal,
): Promise<void> => {
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const size = (await handle.stat()).size;
    const reader = new CacheMp4BoxReader({
      signal,
      read: async (position, length) => {
        const header = Buffer.alloc(length);
        const { bytesRead } = await handle.read(header, 0, length, position);
        return header.subarray(0, bytesRead);
      },
    });
    const scan = async (
      start: number,
      end: number,
      inMoov = false,
    ): Promise<void> => {
      for (const box of await reader.scan(start, end)) {
        signal?.throwIfAborted();
        if (box.type === 'moof' || box.type === 'mvex')
          throw Error('CACHE_FRAGMENTED_SOURCE');
        if (box.type === 'moov' && !inMoov)
          await scan(box.start + box.headerBytes, box.end, true);
      }
    };
    await scan(0, size);
  } finally {
    await handle.close();
  }
};
