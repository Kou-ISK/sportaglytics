import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAC_LLAMA_VERSION = 'b7849';
export const MAC_LLAMA_NOTICE_HASHES = Object.freeze({
  'LICENSE-jsonhpp':
    'c0d068392ea65358b798b8c165103560f06e9e3b38c4ab4e2d8810a7b931af86',
  'LICENSE-cpp-httplib':
    '4b45cbe16d7b71b89ae6127e26e0d90a029198ca5e958ad8e3d0b8bbed364d8b',
  'LICENSE-BoringSSL':
    '827c8d8fc207c2392794eef9e00fe246f9f61fdcc132556c275be3dd8c3cd97f',
});
const sourceDirectory = fileURLToPath(
  new URL('../resources/third-party/llama-b7849/', import.meta.url),
);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const readNotices = async (directory, binaryPath, version) => {
  if (version !== MAC_LLAMA_VERSION)
    throw new Error(
      'Review macOS llama.cpp dependency notices for this version.',
    );
  const binary = await readFile(binaryPath);
  const notices = [];
  for (const [name, expected] of Object.entries(MAC_LLAMA_NOTICE_HASHES)) {
    const bytes = await readFile(join(directory, name));
    if (sha256(bytes) !== expected)
      throw new Error(`Invalid macOS llama.cpp dependency notice: ${name}`);
    // b7849 embeds these complete texts for --license. Check the binding without
    // executing a downloaded runtime or loading a model.
    if (!binary.includes(bytes))
      throw new Error(
        `macOS llama.cpp does not embed the reviewed notice: ${name}`,
      );
    notices.push({ name, bytes, sha256: expected });
  }
  return notices;
};

export const copyMacLlamaNotices = async (directory, version) => {
  const notices = await readNotices(
    sourceDirectory,
    join(directory, 'llama-completion'),
    version,
  );
  await mkdir(join(directory, 'licenses'), { recursive: true });
  const hashes = {};
  for (const notice of notices) {
    const path = `licenses/${notice.name}`;
    await writeFile(join(directory, path), notice.bytes);
    hashes[path] = notice.sha256;
  }
  return hashes;
};

export const verifyMacLlamaNotices = async (directory, version) => {
  await readNotices(
    join(directory, 'licenses'),
    join(directory, 'llama-completion'),
    version,
  );
};
