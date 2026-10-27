import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hashFile } from '../download-verified.mjs';

export const PAYLOAD_FILES = [
  'NativeProductHost',
  'Receiver.node',
  'build.json',
  'licenses/Node-LICENSE.txt',
  'licenses/SporTagLytics-LICENSE.txt',
  'licenses/NOTICE.md',
].sort();

export async function regularFiles(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await regularFiles(root, name)));
    else if (entry.isFile()) result.push(name);
    else throw Error(`Unexpected nonregular native file: ${name}`);
  }
  return result.sort();
}

export async function hashFiles(root, files) {
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > 2048 ||
    new Set(files).size !== files.length ||
    files.some(
      (file) =>
        typeof file !== 'string' ||
        file.length > 512 ||
        !/^[\w./-]+$/.test(file) ||
        file.split('/').some((part) => !part || part === '.' || part === '..'),
    )
  )
    throw Error('Unsafe native input file list');
  const result = {};
  for (const file of [...files].sort()) {
    if (!(await lstat(join(root, file))).isFile())
      throw Error(`Expected regular native input: ${file}`);
    result[file] = await hashFile(join(root, file));
  }
  return result;
}

// This checks unsigned build/cache bytes. Signed distribution verification is
// separate: signing legitimately changes Mach-O bytes, never source/NOTICE.
export async function verifyNativeBuild(directory, identity) {
  if (
    JSON.stringify(await regularFiles(directory)) !==
    JSON.stringify(PAYLOAD_FILES)
  )
    throw Error('Unexpected native payload file set');
  const manifest = JSON.parse(
    await readFile(join(directory, 'build.json'), 'utf8'),
  );
  if (JSON.stringify(manifest.identity) !== JSON.stringify(identity))
    throw Error('Native build inputs changed');
  const files = PAYLOAD_FILES.filter((file) => file !== 'build.json');
  if (
    JSON.stringify(Object.keys(manifest.files ?? {}).sort()) !==
    JSON.stringify(files)
  )
    throw Error('Native manifest file set mismatch');
  for (const file of files) {
    if ((await hashFile(join(directory, file))) !== manifest.files[file])
      throw Error(`Native build hash mismatch: ${file}`);
  }
  return manifest;
}
