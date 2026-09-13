import { execFileSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadVerified, hashFile } from './download-verified.mjs';
import { run } from './media-tools/process.mjs';

if (process.platform !== 'darwin')
  throw new Error('Prepare macOS runtimes on macOS.');
const version = 'b7849';
const archives = {
  x64: 'ab35f38e06e09168754efcc055dbd027d5ead678c7d8ca46486b5903563902d2',
  arm64: 'b5b8e2f544a2dbfd20a830291843fe3463152fef3999d170f5b00e91b671eb64',
};
for (const [arch, archiveHash] of Object.entries(archives)) {
  const output = resolve('.cache/llama', `darwin-${arch}`);
  const identity = {
    version,
    archiveHash,
    revision: 1,
    target: `darwin-${arch}`,
  };
  try {
    const manifest = JSON.parse(
      await readFile(join(output, 'build.json'), 'utf8'),
    );
    if (JSON.stringify(manifest.identity) === JSON.stringify(identity)) {
      const valid = await Promise.all(
        Object.entries(manifest.files).map(
          async ([name, sha256]) =>
            (await hashFile(join(output, name))) === sha256,
        ),
      );
      if (valid.length > 1 && valid.every(Boolean)) {
        console.log(`Verified cached macOS ${arch} llama.cpp`);
        continue;
      }
    }
  } catch {
    /* Prepare a missing or invalid cache. */
  }
  const archive = resolve('.cache/llama', `${version}-macos-${arch}.tar.gz`);
  await downloadVerified(
    `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-macos-${arch}.tar.gz`,
    archive,
    archiveHash,
  );
  const temporary = await mkdtemp(join(tmpdir(), 'sportaglytics-mac-llama-'));
  try {
    await run('tar', ['-xf', archive, '-C', temporary]);
    const source = join(temporary, `llama-${version}`);
    const staged = `${output}.staging`;
    await rm(staged, { recursive: true, force: true });
    await mkdir(staged, { recursive: true });
    const files = {};
    for (const name of await readdir(source)) {
      if (
        name !== 'LICENSE' &&
        name !== 'llama-completion' &&
        !/^lib(?:llama|ggml[^.]*)\..*dylib$/.test(name)
      )
        continue;
      const destination = join(staged, name);
      // Materialize archive symlinks so signing and resource copying use the same files.
      await copyFile(join(source, name), destination);
      if (name !== 'LICENSE') {
        execFileSync('lipo', [
          destination,
          '-verify_arch',
          arch === 'x64' ? 'x86_64' : arch,
        ]);
        const dependencies = execFileSync('otool', ['-L', destination], {
          encoding: 'utf8',
        });
        for (const line of dependencies.split('\n').slice(1)) {
          const dependency = line.trim().split(' (')[0];
          if (
            dependency &&
            !dependency.startsWith('@rpath/') &&
            !dependency.startsWith('/usr/lib/') &&
            !dependency.startsWith('/System/Library/')
          ) {
            throw new Error(`Non-portable macOS dependency: ${dependency}`);
          }
          if (dependency.startsWith('@rpath/'))
            await readFile(join(source, dependency.slice(7)));
        }
      }
      files[name] = await hashFile(destination);
    }
    if (!files['llama-completion'] || !files.LICENSE)
      throw new Error('Incomplete macOS AI runtime');
    await writeFile(
      join(staged, 'build.json'),
      JSON.stringify({ identity, files }, null, 2),
    );
    await rm(output, { recursive: true, force: true });
    await rename(staged, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
