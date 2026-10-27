import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  arrayValue,
  objectValue,
  stringValue,
  numberValue,
} from '../../../src/shared/validation/jsonValues';
import { isPackageCaptureActive } from '../liveCapture/captureRegistry';
import { isPackageUpdating } from '../ipc/packageUpdateLeases';
import { cacheFileRevision } from '../playbackCache/sourceIdentity';

export interface NativeSourceAccess {
  path: string;
  url: string;
  key: string;
  sourceEnd: number | null;
  assertCurrent: () => Promise<void>;
}
const readConfig = async (file: string): Promise<Buffer> => {
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024)
      throw Error('NATIVE_CONFIG_LIMIT');
    const data = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(data);
    if (bytesRead !== stat.size) throw Error('NATIVE_CONFIG_CHANGED');
    return data.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};
const digest = (data: Buffer | string): string =>
  createHash('sha256').update(data).digest('hex');

/** Called only for the authenticated main window's bound package. The source
 * comes from its current metadata, never from an IPC path supplied by a caller.
 * Existing absolute local references are retained; relative references cannot
 * escape the package. No media bytes or directory inventories are scanned. */
export const resolveNativeSource = async (
  packagePath: string,
): Promise<NativeSourceAccess> => {
  const root = await fs.realpath(packagePath);
  const configPath = path.join(root, '.metadata', 'config.json');
  const assertPackage = async (): Promise<void> => {
    if (isPackageCaptureActive(packagePath) || isPackageUpdating(packagePath))
      throw Error('NATIVE_PACKAGE_BUSY');
    if (
      (await fs.realpath(packagePath)) !== root ||
      (await fs.lstat(path.dirname(configPath))).isSymbolicLink()
    )
      throw Error('NATIVE_PACKAGE_CHANGED');
  };
  await assertPackage();
  const raw = await readConfig(configPath),
    fingerprint = digest(raw);
  const config = objectValue(JSON.parse(raw.toString('utf8')));
  const angle = objectValue(arrayValue(config.angles, 1, 1)[0]);
  const clip = objectValue(arrayValue(angle.clips, 1, 1)[0]);
  if (
    angle.sourceKind !== 'local' ||
    clip.sourceKind !== 'local' ||
    (clip.timelineStartSeconds ?? 0) !== 0 ||
    (clip.gapBeforeSeconds ?? 0) !== 0
  )
    throw Error('NATIVE_UNSUPPORTED_PACKAGE');
  const sourceEnd =
    clip.durationSeconds === undefined
      ? null
      : numberValue(clip.durationSeconds, Number.MIN_VALUE, 86400);
  const reference = stringValue(clip.relativePath, 1, 4096);
  const source = path.resolve(root, reference),
    relative = path.relative(root, source);
  if (
    (!path.isAbsolute(reference) &&
      (relative.startsWith('..') || path.isAbsolute(relative))) ||
    path.extname(source).toLowerCase() !== '.mp4'
  )
    throw Error('NATIVE_UNSUPPORTED_SOURCE');
  const inspect = async (): Promise<string> => {
    if ((await fs.realpath(source)) !== source)
      throw Error('NATIVE_SOURCE_SYMLINK');
    const stat = await fs.lstat(source, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0n)
      throw Error('NATIVE_SOURCE_INVALID');
    return cacheFileRevision(stat);
  };
  const revision = await inspect();
  return {
    sourceEnd,
    path: source,
    url: pathToFileURL(source).href,
    key: digest(JSON.stringify([root, angle.id, clip.id, reference, revision])),
    assertCurrent: async () => {
      await assertPackage();
      if (
        (await inspect()) !== revision ||
        digest(await readConfig(configPath)) !== fingerprint
      )
        throw Error('NATIVE_SOURCE_CHANGED');
    },
  };
};
