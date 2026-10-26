import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { NativeRuntimePaths } from './nativeRuntime';

const files = [
  'NativeProductHost',
  'Receiver.node',
  'build.json',
  'licenses/FFmpeg-LGPL-2.1.txt',
  'licenses/FFmpeg-LICENSE.md',
  'licenses/Node-LICENSE.txt',
  'licenses/SporTagLytics-LICENSE.txt',
  'licenses/NOTICE.md',
].sort();
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const hashFile = async (file: string): Promise<string> => {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > 16 * 1024 * 1024)
    throw Error('NATIVE_RESOURCE_BOUND');
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
};

/** Validate only the fixed unsigned preview resources. Signed helper bytes
 * require a separate qualified distribution contract; mismatch keeps fallback. */
export const resolveNativeResources = async (
  resources: string,
  state: string,
): Promise<NativeRuntimePaths> => {
  const root = path.join(resources, 'native-playback');
  for (const directory of [root, path.join(root, 'licenses')])
    if (!(await lstat(directory)).isDirectory())
      throw Error('NATIVE_RESOURCE_DIRECTORY');
  const actual = [
    ...(await readdir(root)).filter((name) => name !== 'licenses'),
    ...(await readdir(path.join(root, 'licenses'))).map(
      (name) => `licenses/${name}`,
    ),
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(files))
    throw Error('NATIVE_RESOURCE_SET');
  const manifestFile = path.join(root, 'build.json');
  const stat = await lstat(manifestFile);
  if (!stat.isFile() || stat.size > 65536) throw Error('NATIVE_MANIFEST_BOUND');
  const manifest: unknown = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (
    !record(manifest) ||
    !record(manifest.identity) ||
    !record(manifest.files) ||
    manifest.identity.revision !== 2 ||
    manifest.identity.platform !== 'darwin' ||
    manifest.identity.architecture !== 'arm64' ||
    manifest.identity.napiVersion !== 8 ||
    manifest.identity.minimumMacOS !== '13.0' ||
    JSON.stringify(Object.keys(manifest.files).sort()) !==
      JSON.stringify(files.filter((file) => file !== 'build.json'))
  )
    throw Error('NATIVE_MANIFEST_IDENTITY');
  for (const file of files.filter((file) => file !== 'build.json')) {
    const hash = manifest.files[file];
    if (
      typeof hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(hash) ||
      (await hashFile(path.join(root, file))) !== hash
    )
      throw Error('NATIVE_RESOURCE_HASH');
  }
  return {
    host: path.join(root, 'NativeProductHost'),
    receiver: path.join(root, 'Receiver.node'),
    state,
  };
};
