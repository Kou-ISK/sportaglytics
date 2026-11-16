import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { objectValue } from '../../../src/shared/validation/jsonValues';
import { isPackageCaptureActive } from '../liveCapture/captureRegistry';
import { isPackageUpdating } from '../ipc/packageUpdateLeases';
import { cacheFileRevision } from '../playbackCache/sourceIdentity';

export const nativeSourceDigest = (value: Buffer | string): string =>
  createHash('sha256').update(value).digest('hex');

const readConfig = async (file: string): Promise<Buffer> => {
  const handle = await fs.open(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024)
      throw Error('NATIVE_CONFIG_LIMIT');
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes);
    if (bytesRead !== stat.size) throw Error('NATIVE_CONFIG_CHANGED');
    return bytes.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

export interface NativePackageAccess {
  readonly root: string;
  readonly fingerprint: string;
  readonly config: Record<string, unknown>;
  assertPackageCurrent(): Promise<void>;
  assertCurrent(): Promise<void>;
}

/** Main-only snapshot of the bound document. File identity is rechecked, not
 * pinned against arbitrary same-UID ancestor replacement while a helper opens. */
export const openNativePackageAccess = async (
  packagePath: string,
): Promise<NativePackageAccess> => {
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
  const raw = await readConfig(configPath);
  const fingerprint = nativeSourceDigest(raw);
  return {
    root,
    fingerprint,
    config: objectValue(JSON.parse(raw.toString('utf8'))),
    assertPackageCurrent: assertPackage,
    async assertCurrent(): Promise<void> {
      await assertPackage();
      if (nativeSourceDigest(await readConfig(configPath)) !== fingerprint)
        throw Error('NATIVE_SOURCE_CHANGED');
    },
  };
};

export interface NativeLocalFile {
  readonly path: string;
  readonly url: string;
  readonly revision: string;
  assertCurrent(): Promise<void>;
}

/** Only a reference read from current package metadata is accepted here. */
export const inspectNativeLocalFile = async (
  root: string,
  reference: string,
): Promise<NativeLocalFile> => {
  const source = path.resolve(root, reference);
  const relative = path.relative(root, source);
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
    path: source,
    url: pathToFileURL(source).href,
    revision,
    async assertCurrent(): Promise<void> {
      if ((await inspect()) !== revision) throw Error('NATIVE_SOURCE_CHANGED');
    },
  };
};
